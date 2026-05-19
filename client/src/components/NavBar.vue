<script setup>
import { ref } from 'vue'
import { auth } from '../firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useRouter } from 'vue-router'

const user = ref(null)
const router = useRouter()
const showMenu = ref(false)

onAuthStateChanged(auth, (u) => {
  user.value = u
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
  <nav class="bg-white sticky top-0 z-30 shadow-sm border-b border-gray-100">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <router-link to="/dashboard" class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
            FS
          </div>
          <div class="font-bold text-xl text-gray-900 tracking-tight">FileShare Secure</div>
        </router-link>
      </div>

      <div class="hidden md:flex items-center gap-6">
        <template v-if="user">
          <router-link to="/dashboard" class="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Tableau de bord</router-link>
          <div class="h-4 w-px bg-gray-200"></div>
          <div class="flex items-center gap-4">
            <span class="text-sm font-medium text-gray-800 bg-gray-100 px-3 py-1 rounded-full">{{ user.email }}</span>
            <button @click="logout" class="text-sm font-medium text-red-500 hover:text-red-700 transition-colors">Déconnexion</button>
          </div>
        </template>
        <template v-else>
          <router-link to="/login" class="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Connexion</router-link>
          <router-link to="/register" class="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm transition-all">Créer un compte</router-link>
        </template>
      </div>

      <button @click="toggleMenu" class="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="showMenu" class="md:hidden bg-white border-t border-gray-100">
      <div class="px-4 py-4 flex flex-col gap-4">
        <template v-if="user">
          <router-link to="/dashboard" class="text-sm font-medium text-gray-800" @click="toggleMenu">Tableau de bord</router-link>
          <div class="h-px w-full bg-gray-100"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-500">{{ user.email }}</span>
            <button @click="logout" class="text-sm font-medium text-red-500">Déconnexion</button>
          </div>
        </template>
        <template v-else>
          <router-link to="/login" class="block w-full text-center text-sm font-medium text-gray-600 hover:bg-gray-50 py-2 rounded-lg" @click="toggleMenu">Connexion</router-link>
          <router-link to="/register" class="block w-full text-center text-sm font-medium bg-indigo-600 text-white py-2 rounded-lg" @click="toggleMenu">Créer un compte</router-link>
        </template>
      </div>
    </div>
  </nav>
</template>
