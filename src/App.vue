<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col selection:bg-slate-200 selection:text-slate-900">
    <NavBar />
    <main class="flex-1 flex flex-col items-center justify-start py-8 sm:py-12 w-full">
      <div class="w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import NavBar from './components/NavBar.vue'
</script>
