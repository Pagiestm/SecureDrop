<script setup>
import { ref, computed, onMounted } from 'vue'
import { db, auth, storage, functions } from '../firebase'
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, updateDoc, where, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { onAuthStateChanged } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'

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

const loadFiles = () => {
  if (unsubscribeFiles) unsubscribeFiles()
  
  loading.value = true
  const qOwner = query(collection(db, 'files'), where('ownerId', '==', user.value.uid))
  
  unsubscribeFiles = onSnapshot(qOwner, (snapshot) => {
    const ownerFiles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    files.value = ownerFiles.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
    loading.value = false
  })
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
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
      
      await addDoc(collection(db, 'files'), {
        name: file.name,
        size: file.size,
        type: file.type,
        url: downloadURL,
        path: path,
        ownerId: user.value.uid,
        sharedWith: [],
        createdAt: serverTimestamp()
      })
      
      uploading.value = false
      event.target.value = ''
    }
  )
}

const deleteFile = async (f) => {
  if (!confirm("Supprimer ce fichier de manière permanente ?")) return
  
  try {
    const sRef = storageRef(storage, f.path)
    await deleteObject(sRef)
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

const generateShareLink = async (f) => {
  try {
    // Appel du FaaS Firebase en local via emulator
    const generateSecureProtocolLink = httpsCallable(functions, 'generateSecureProtocolLink');
    
    const result = await generateSecureProtocolLink({ fileId: f.id, ownerId: user.value.uid });
    
    linkGenerated.value = result.data.secureLink;
    linkExpiresAt.value = result.data.expiresAt || (Date.now() + 30 * 60 * 1000);
    
  } catch (err) {
    // Mode démo s'il n'y a pas de FaaS up
    console.error(err);
    linkGenerated.value = f.url;
    linkExpiresAt.value = null;
    alert(`[Erreur FaaS - Fallback] Lien direct non-vérifié (Si les Storage rules bloquent = inaccessible):\n${f.url}`);
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
  <div class="py-8">
    <div class="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Mes Fichiers Sécurisés</h1>
        <p class="text-gray-500 mt-1">Partage et stockage chiffré dans le Cloud.</p>
      </div>
      <div v-if="!loading">
        <input type="file" ref="fileInput" class="hidden" @change="handleFileUpload" />
        <button 
          @click="triggerUpload"
          :disabled="uploading"
          class="bg-indigo-600 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
          {{ uploading ? `Upload... ${uploadProgress}%` : 'Uploader un fichier' }}
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="p-2" v-if="loading">
        <div class="p-8 text-center text-gray-400">Chargement de vos fichiers...</div>
      </div>
      
      <div class="p-2" v-else-if="files.length === 0">
        <div class="p-12 text-center">
          <div class="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-10 h-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900">Aucun fichier sécurisé</h3>
          <p class="text-gray-500 mt-1">Uploadez votre premier fichier pour commencer à partager.</p>
        </div>
      </div>
      
      <div class="overflow-x-auto" v-else>
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50/50 border-b border-gray-100 text-sm text-gray-500">
              <th class="p-4 font-medium">Nom du fichier</th>
              <th class="p-4 font-medium">Taille</th>
              <th class="p-4 font-medium">Date d'ajout</th>
              <th class="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="f in files" :key="f.id" class="hover:bg-gray-50/80 transition-colors group">
              <td class="p-4">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
                  </div>
                  <span class="font-medium text-gray-900 flex-1">{{ f.name }}</span>
                </div>
              </td>
              <td class="p-4 text-gray-500 text-sm">{{ formatSize(f.size) }}</td>
              <td class="p-4 text-gray-500 text-sm">
                {{ f.createdAt ? f.createdAt.toDate().toLocaleDateString() : 'À l\'instant' }}
              </td>
              <td class="p-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button @click="generateShareLink(f)" class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Partager un lien sécurisé">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
                  </button>
                  <a :href="f.url" target="_blank" class="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Télécharger">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
                  </a>
                  <button @click="deleteFile(f)" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Link box -->
      <div v-if="linkGenerated" class="p-4 border-t bg-gray-50 flex items-center justify-between gap-4">
        <div class="flex-1">
          <div class="text-sm text-gray-600">Lien sécurisé (temporaire)</div>
          <div class="mt-1 flex items-center gap-2">
            <input class="flex-1 p-2 rounded-md border" :value="linkGenerated" readonly />
            <button @click="copyLink" class="px-3 py-2 bg-indigo-600 text-white rounded-md">Copier</button>
          </div>
          <div class="text-xs text-gray-500 mt-2">Expirera : <strong>{{ formattedExpiry || 'Inconnu' }}</strong></div>
        </div>
        <div>
          <a :href="linkGenerated" target="_blank" class="px-4 py-2 bg-green-600 text-white rounded-md">Ouvrir</a>
        </div>
      </div>
    </div>
  </div>
</template>