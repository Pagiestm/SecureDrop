<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '../firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const submit = async () => {
  error.value = ''
  loading.value = true
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value)
    const uid = userCredential.user.uid
    
    await setDoc(doc(db, 'users', uid), {
      email: email.value,
      uid: uid,
      createdAt: serverTimestamp()
    })
    
    router.push('/dashboard')
  } catch (e) {
    console.error('Register failed', e)
    error.value = 'Erreur lors de la création de compte.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <div class="bg-white p-8 sm:p-10 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100">
      <div class="mb-8">
        <div class="w-12 h-12 mx-auto bg-slate-900 rounded-xl flex items-center justify-center shadow-sm mb-6">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h2 class="text-center text-2xl font-bold text-slate-900 tracking-tight">Créer un compte</h2>
        <p class="mt-2 text-center text-sm text-slate-500">
          Rejoignez la plateforme sécurisée
        </p>
      </div>
      
      <form class="space-y-5" @submit.prevent="submit">
        <div v-if="error" class="bg-red-50/50 border border-red-100 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {{ error }}
        </div>
        
        <div class="space-y-4">
          <div>
            <label for="email-address" class="block text-sm font-medium text-slate-700 mb-1.5">Adresse email</label>
            <input 
              id="email-address" 
              v-model="email" 
              type="email" 
              required 
              class="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 focus:bg-white transition-colors sm:text-sm" 
              placeholder="marie@exemple.com" 
            />
          </div>
          <div>
            <label for="password" class="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
            <input 
              id="password" 
              v-model="password" 
              type="password" 
              required 
              class="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 focus:bg-white transition-colors sm:text-sm" 
              placeholder="••••••••" 
              minlength="6"
            />
          </div>
        </div>

        <div class="pt-2">
          <button 
            type="submit" 
            :disabled="loading" 
            class="w-full flex justify-center items-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
            {{ loading ? 'Création en cours...' : "S'inscrire" }}
          </button>
        </div>
        
        <div class="text-center text-sm mt-6">
          <span class="text-slate-500">Déjà inscrit ?</span>
          <router-link to="/login" class="ml-1.5 font-medium text-slate-900 hover:underline underline-offset-4 transition-all">Se connecter</router-link>
        </div>
      </form>
    </div>
  </div>
</template>
