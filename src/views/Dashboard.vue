<script setup>
import { ref, computed } from 'vue'
import { db, auth, storage } from '../firebase'
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, updateDoc, where, serverTimestamp, getDocs } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, deleteObject } from 'firebase/storage'
import { onAuthStateChanged } from 'firebase/auth'
import UploadArea from '../components/files/UploadArea.vue'
import LinkBanner from '../components/files/LinkBanner.vue'
import FileTable from '../components/files/FileTable.vue'

const files = ref([])
const user = ref(null)
const loading = ref(true)
const uploading = ref(false)
const uploadProgress = ref(0)
const linkGenerated = ref('')
const linkExpiresAt = ref(null)
const uploadAreaRef = ref(null)

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

const handleFileUpload = async (file) => {
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

const triggerUpload = () => {
  uploadAreaRef.value?.openPicker?.()
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
        <UploadArea ref="uploadAreaRef" :uploading="uploading" :progress="uploadProgress" @file-selected="handleFileUpload" />
      </div>
    </div>

    <LinkBanner :link="linkGenerated" :expiresAt="linkExpiresAt" @copy="copyLink" />

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
      <FileTable v-else :files="files" :loading="loading" @share="shareFile" @download="downloadFile" @delete="deleteFile" />
    </div>
  </div>
</template>