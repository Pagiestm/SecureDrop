<template>
  <div>
    <NavBar />
    <main class="flex items-start justify-center py-12">
      <div class="w-full max-w-5xl px-4">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import NavBar from './components/NavBar.vue'
</script>
