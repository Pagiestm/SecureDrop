<script setup>
import { computed } from 'vue'
const props = defineProps({
  link: { type: String, default: '' },
  expiresAt: { type: [Number, String, Date], default: null }
})
const emit = defineEmits(['copy'])

const formattedExpiry = computed(() => {
  if (!props.expiresAt) return null
  const d = new Date(props.expiresAt)
  return d.toLocaleString()
})

const copy = () => {
  if (!props.link) return
  navigator.clipboard?.writeText(props.link).then(() => emit('copy'))
}
</script>

<template>
  <div v-if="link" class="mb-6 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
      <input class="flex-1 sm:w-64 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-600 focus:outline-none" :value="link" readonly />
      <button @click="copy" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors shadow-sm">Copier</button>
      <a :href="link" target="_blank" class="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 transition-colors shadow-sm">Ouvrir</a>
    </div>
  </div>
</template>
