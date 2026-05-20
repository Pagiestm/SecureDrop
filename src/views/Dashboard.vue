<script setup>
import { ref, computed, onMounted } from 'vue'
import { db, auth, storage } from '../firebase'
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, updateDoc, where, serverTimestamp, getDocs } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, deleteObject } from 'firebase/storage'
import { onAuthStateChanged } from 'firebase/auth'

const files = ref([])
const user = ref(null)
const loading = ref(true)
const uploading = ref(false)
const uploadProgress = ref(0)
const fileInput = ref(null)
const selectedFile = ref(null)
const linkGenerated = ref('')
const linkExpiresAt = ref(null)

let unsubscribeFiles = null;

const loadFiles = async () => {
  if (unsubscribeFiles) unsubscribeFiles()
  
  loading.value = true
  const qOwner = query(collection(db, 'files'), where('ownerId', '==', user.value.uid))
  const qShared = query(collection(db, 'files'), where('sharedWithUids', 'array-contains', user.value.uid))

  const ownerFilesMap = {}
  const sharedFilesMap = {}

  const toFileList = (snapshot) => snapshot.docs.map(d => {
    const data = d.data()
    const file = { id: d.id, ...data }
    return file
  })

  const mergeAndSort = () => {
    const merged = new Map()
    if (ownerFilesMap.owner) {
      ownerFilesMap.owner.forEach(f => merged.set(f.id, f))
    }
    if (sharedFilesMap.shared) {
      sharedFilesMap.shared.forEach(f => merged.set(f.id, f))
    }
    files.value = [...merged.values()].sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
    if (ownerFilesMap.owner && sharedFilesMap.shared) {
      loading.value = false
    }
  }

  try {
    const [ownerSnapshot, sharedSnapshot] = await Promise.all([getDocs(qOwner), getDocs(qShared)])
    ownerFilesMap.owner = toFileList(ownerSnapshot)
    sharedFilesMap.shared = toFileList(sharedSnapshot)
    mergeAndSort()
  } catch (error) {
    console.error('Erreur lors du chargement initial des fichiers', error)
  } finally {
    loading.value = false
  }

  const unsubOwner = onSnapshot(qOwner, (snapshot) => {
    ownerFilesMap.owner = toFileList(snapshot)
    mergeAndSort()
  }, (error) => {
    console.error('Erreur snapshot propriétaire', error)
    loading.value = false
  })

  const unsubShared = onSnapshot(qShared, (snapshot) => {
    sharedFilesMap.shared = toFileList(snapshot)
    mergeAndSort()
  }, (error) => {
    console.error('Erreur snapshot partagés', error)
    loading.value = false
  })
  
  unsubscribeFiles = () => {
    unsubOwner()
    unsubShared()
  }
}

onAuthStateChanged(auth, (u) => {
  user.value = u
  if (u) {
    loadFiles()
  } else {
    files.value = []
    loading.value = false
  }
})

const triggerUpload = () => {
  fileInput.value.click()
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file || !user.value) return

  uploading.value = true
  uploadProgress.value = 0

  const path = `users/${user.value.uid}/${Date.now()}_${file.name}`
  const sRef = storageRef(storage, path)

  const uploadTask = uploadBytesResumable(sRef, file)

  uploadTask.on('state_changed',
    (snapshot) => {
      uploadProgress.value = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
    },
    (error) => {
      console.error("Erreur d'upload", error)
      uploading.value = false
    },
    async () => {
      try {
        await addDoc(collection(db, 'files'), {
          name: file.name,
          size: file.size,
          type: file.type,
          path: path,
          ownerId: user.value.uid,
          sharedWithUids: [],
          createdAt: serverTimestamp()
        })
      } catch (e) {
        console.error('Erreur lors de la finalisation de l\'upload', e)
      } finally {
        uploading.value = false
        event.target.value = ''
      }
    }
  )
}

const deleteFile = async (f) => {
  if (!confirm("Supprimer ce fichier de manière permanente ?")) return
  
  try {
    if (f.path) {
      const sRef = storageRef(storage, f.path)
      await deleteObject(sRef)
    }
    await deleteDoc(doc(db, 'files', f.id))
  } catch (e) {
    console.error("Erreur lors de la suppression", e)
  }
}

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const shareFile = async (f) => {
  // Prompt for expiry in hours (default 24)
  const input = window.prompt('Durée de validité du lien en heures (par défaut 24):', '24')
  if (input === null) return
  const hours = Number(input)
  if (isNaN(hours) || hours <= 0) {
    alert('Durée invalide')
    return
  }
  const expiresInSeconds = Math.floor(hours * 3600)

  // Reuse existing generateShareLink implementation with TTL
  await generateShareLink(f, expiresInSeconds)
}

const resolveProjectId = () => {
  const configuredProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  if (configuredProjectId && configuredProjectId !== 'your_project_id') {
    return configuredProjectId
  }
  return 'fir-demo-dd7df'
}

const generateShareLink = async (f, expiresInSeconds = undefined) => {
  if (!auth.currentUser) {
    alert('Vous devez être connecté pour générer un lien')
    return
  }

  if (!f.path) {
    alert('Impossible de générer un lien sécurisé sans fichier dans Storage')
    return
  }

  try {
    const idToken = await auth.currentUser.getIdToken()
    const projectId = resolveProjectId()
    const body = { fileId: f.id }
    if (typeof expiresInSeconds === 'number') body.expiresInSeconds = expiresInSeconds

    const response = await fetch(`http://127.0.0.1:5001/${projectId}/us-central1/createShareLink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Erreur lors de la création du lien')
    }

    linkGenerated.value = data.downloadUrl
    linkExpiresAt.value = data.expiresAt
  } catch (error) {
    console.error('Erreur lors de la génération du lien', error)
    alert('Impossible de générer le lien sécurisé')
  }
}

const downloadFile = async (f) => {
  try {
    if (!f.path) {
      alert('Fichier non disponible pour téléchargement')
      return
    }

    const projectId = resolveProjectId()

    const idToken = await auth.currentUser?.getIdToken()
    const linkResponse = await fetch(`http://127.0.0.1:5001/${projectId}/us-central1/createShareLink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify({ fileId: f.id })
    })

    const data = await linkResponse.json()
    if (!linkResponse.ok) {
      throw new Error(data.error || 'Impossible de créer un lien sécurisé')
    }

    const downloadUrl = data.downloadUrl

    const blobResponse = await fetch(downloadUrl)
    const blob = await blobResponse.blob()

    // Create download link
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = f.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Erreur lors du téléchargement:', err)
    alert('Erreur lors du téléchargement du fichier')
  }
}

const copyLink = async () => {
  if (!linkGenerated.value) return;
  try {
    await navigator.clipboard.writeText(linkGenerated.value);
    alert('Lien copié dans le presse-papiers');
  } catch (e) {
    console.error('Copy failed', e);
  }
}

const formattedExpiry = computed(() => {
  if (!linkExpiresAt.value) return null;
  const d = new Date(linkExpiresAt.value);
  return d.toLocaleString();
})
</script>

<template>
  <div class="py-2">
    <div class="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Mes Fichiers Sécurisés</h1>
        <p class="text-slate-500 mt-1 text-sm">Partage et stockage chiffré dans le Cloud.</p>
      </div>
      <div v-if="!loading">
        <input type="file" ref="fileInput" class="hidden" @change="handleFileUpload" />
        <button 
          @click="triggerUpload"
          :disabled="uploading"
          class="bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
        >
          <svg v-if="!uploading" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          <svg v-else class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          {{ uploading ? `Upload (${uploadProgress}%)` : 'Nouveau fichier' }}
        </button>
      </div>
    </div>

    <!-- Active Link Banner -->
    <div v-if="linkGenerated" class="mb-6 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-start sm:items-center gap-3">
        <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
        </div>
        <div class="flex-1">
          <div class="text-sm font-medium text-slate-800">Lien sécurisé temporaire</div>
          <div class="text-xs text-slate-500 mt-0.5">Expirera le <strong>{{ formattedExpiry || 'Inconnu' }}</strong></div>
        </div>
      </div>
      
      <div class="flex w-full sm:w-auto items-center gap-2">
        <input class="flex-1 sm:w-64 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-600 focus:outline-none" :value="linkGenerated" readonly />
        <button @click="copyLink" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors shadow-sm">Copier</button>
        <a :href="linkGenerated" target="_blank" class="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 transition-colors shadow-sm">Ouvrir</a>
      </div>
    </div>

    <!-- Main Card -->
    <div class="bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
      <!-- Loading State -->
      <div class="p-12 flex flex-col items-center justify-center text-slate-400" v-if="loading">
        <svg class="animate-spin h-8 w-8 text-slate-300 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <div class="text-sm font-medium">Chargement sécurisé...</div>
      </div>
      
      <!-- Empty State -->
      <div class="p-16 text-center" v-else-if="files.length === 0">
        <div class="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </div>
        <h3 class="text-base font-semibold text-slate-900">Aucun fichier disponible</h3>
        <p class="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Commencez par uploader un document pour le rendre accessible et le partager en toute sécurité.</p>
        <button @click="triggerUpload" class="mt-6 text-sm font-medium text-slate-900 hover:text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
          Ajouter un fichier
        </button>
      </div>
      
      <!-- Table View -->
      <div class="overflow-x-auto" v-else>
        <table class="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr class="bg-slate-50/50 border-b border-slate-200/60 text-xs font-semibold tracking-wider text-slate-500 uppercase">
              <th class="px-6 py-4">Nom du fichier</th>
              <th class="px-6 py-4 w-32">Taille</th>
              <th class="px-6 py-4 w-40">Date d'ajout</th>
              <th class="px-6 py-4 w-32 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="f in files" :key="f.id" class="hover:bg-slate-50/50 transition-colors group">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-500">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                  </div>
                  <span class="font-medium text-sm text-slate-900 truncate max-w-[200px] sm:max-w-xs md:max-w-md" :title="f.name">{{ f.name }}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-slate-500 text-sm">{{ formatSize(f.size) }}</td>
              <td class="px-6 py-4 text-slate-500 text-sm">
                {{ f.createdAt ? f.createdAt.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'À l\'instant' }}
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button @click="shareFile(f)" class="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors" title="Partager">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                  </button>
                  <button @click="downloadFile(f)" class="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Télécharger">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  </button>
                  <button @click="deleteFile(f)" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Supprimer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>