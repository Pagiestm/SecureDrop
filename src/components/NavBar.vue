<script setup>
import { ref } from 'vue'
import { auth } from '../firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useRouter } from 'vue-router'

const user = ref(null)
const authReady = ref(false)
const router = useRouter()
const showMenu = ref(false)

onAuthStateChanged(auth, (u) => {
  user.value = u
  authReady.value = true
})

const logout = async () => {
  showMenu.value = false
  await signOut(auth)
  router.push('/login')
}

const toggleMenu = () => {
  showMenu.value = !showMenu.value
}
</script>

<template>
  <nav class="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200/60 shadow-sm">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <router-link to="/dashboard" class="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-lg p-1 -ml-1">
          <div class="flex items-center justify-center p-2 bg-slate-900 text-white rounded-lg shadow-sm group-hover:bg-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <div class="font-semibold text-lg text-slate-900 tracking-tight">SecureDrop</div>
        </router-link>
      </div>

      <div class="hidden md:flex items-center gap-6">
        <template v-if="authReady && user">
          <router-link to="/dashboard" class="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Mes Fichiers</router-link>
          <div class="h-4 w-px bg-slate-200"></div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
              <span class="text-sm font-medium text-slate-700">{{ user.email }}</span>
            </div>
            <button @click="logout" class="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Déconnexion</button>
          </div>
        </template>
        <template v-else-if="authReady">
          <router-link to="/login" class="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Connexion</router-link>
          <router-link to="/register" class="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900">Créer un compte</router-link>
        </template>
        <template v-else>
          <div class="h-8 w-40 rounded-md bg-slate-100 animate-pulse"></div>
        </template>
      </div>

      <button @click="toggleMenu" class="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path v-if="!showMenu" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="showMenu" class="md:hidden bg-white border-t border-slate-100 shadow-lg absolute w-full">
      <div class="px-4 py-4 flex flex-col gap-4">
        <template v-if="authReady && user">
          <div class="flex items-center gap-2 mb-2 pb-4 border-b border-slate-100">
             <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold">{{ user.email[0].toUpperCase() }}</div>
             <span class="text-sm font-medium text-slate-700 truncate">{{ user.email }}</span>
          </div>
          <router-link to="/dashboard" class="text-sm font-medium text-slate-800" @click="toggleMenu">Mes Fichiers</router-link>
          <button @click="logout" class="text-sm font-medium text-left text-slate-500 mt-2">Déconnexion</button>
        </template>
        <template v-else-if="authReady">
          <router-link to="/login" class="block w-full text-center text-sm font-medium text-slate-600 hover:bg-slate-50 py-2 rounded-lg" @click="toggleMenu">Connexion</router-link>
          <router-link to="/register" class="block w-full text-center text-sm font-medium bg-slate-900 text-white py-2 rounded-lg shadow-sm" @click="toggleMenu">Créer un compte</router-link>
        </template>
        <template v-else>
          <div class="h-10 w-full rounded-lg bg-slate-100 animate-pulse"></div>
        </template>
      </div>
    </div>
  </nav>
</template>
