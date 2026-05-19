<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const submit = async () => {
  error.value = ''
  loading.value = true
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value)
    router.push('/dashboard')
  } catch (e) {
    error.value = 'Identifiants invalides ou erreur de connexion.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
    <div class="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-50">
      <div>
        <div class="w-16 h-16 mx-auto bg-linear-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mb-6">
          <span class="text-2xl font-bold text-white">FS</span>
        </div>
        <h2 class="text-center text-3xl font-extrabold text-gray-900 tracking-tight">Ravi de vous revoir</h2>
        <p class="mt-2 text-center text-sm text-gray-500">
          Rejoignez votre cloud sécurisé
        </p>
      </div>
      
      <form class="mt-8 space-y-6" @submit.prevent="submit">
        <div v-if="error" class="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center shadow-sm">
          {{ error }}
        </div>
        
        <div class="space-y-4">
          <div>
            <label for="email-address" class="block text-sm font-medium text-gray-700 mb-1">Adresse email</label>
            <input 
              id="email-address" 
              v-model="email" 
              type="email" 
              required 
              class="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm" 
              placeholder="vous@exemple.com" 
            />
          </div>
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input 
              id="password" 
              v-model="password" 
              type="password" 
              required 
              class="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm" 
              placeholder="••••••••" 
            />
          </div>
        </div>

        <div>
          <button 
            type="submit" 
            :disabled="loading" 
            class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-md disabled:opacity-75"
          >
            <span v-if="loading" class="flex items-center gap-2">
              <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
              Connexion...
            </span>
            <span v-else>Se connecter</span>
          </button>
        </div>
        
        <div class="text-center text-sm font-medium mt-4">
          <span class="text-gray-500">Pas encore de compte ?</span>
          <router-link to="/register" class="ml-1 text-indigo-600 hover:text-indigo-500 hover:underline transition-all">Créer un compte</router-link>
        </div>
      </form>
    </div>
  </div>
</template>
