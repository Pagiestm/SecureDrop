<script setup>
import { ref } from 'vue'
const emit = defineEmits(['file-selected'])
const props = defineProps({
  uploading: { type: Boolean, default: false },
  progress: { type: Number, default: 0 },
})

const fileInput = ref(null)

const trigger = () => fileInput.value?.click()
const onFile = (e) => {
  const file = e.target.files?.[0]
  if (file) emit('file-selected', file)
  e.target.value = ''
}

defineExpose({
  openPicker: trigger,
})
</script>

<template>
  <div>
    <input type="file" ref="fileInput" class="hidden" @change="onFile" />
    <button @click="trigger" :disabled="props.uploading" class="bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900">
      <svg v-if="!props.uploading" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
      <svg v-else class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
      {{ props.uploading ? `Upload (${props.progress}%)` : 'Nouveau fichier' }}
    </button>
  </div>
</template>
