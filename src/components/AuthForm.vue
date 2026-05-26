<script setup>
import { ref } from 'vue'
import BaseButton from './ui/BaseButton.vue'
import BaseInput from './ui/BaseInput.vue'

const props = defineProps({
  title: String,
  subtitle: String,
  submitText: String,
  bottomText: String,
  bottomLinkText: String,
  bottomLinkTo: String,
  error: String,
  loading: Boolean,
  requireMinLength: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit'])

const email = ref('')
const password = ref('')

const handleSubmit = () => {
  emit('submit', { email: email.value, password: password.value })
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
        <h2 class="text-center text-2xl font-bold text-slate-900 tracking-tight">{{ title }}</h2>
        <p class="mt-2 text-center text-sm text-slate-500">{{ subtitle }}</p>
      </div>
      
      <form class="space-y-5" @submit.prevent="handleSubmit">
        <div v-if="error" class="bg-red-50/50 border border-red-100 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {{ error }}
        </div>
        
        <div class="space-y-4">
          <BaseInput 
            label="Adresse email"
            type="email"
            v-model="email"
            placeholder="marie@exemple.com"
            required
          />
          <BaseInput 
            label="Mot de passe"
            type="password"
            v-model="password"
            placeholder="••••••••"
            required
            :minlength="requireMinLength ? 6 : null"
          />
        </div>

        <div class="pt-2">
          <BaseButton type="submit" class="w-full" :loading="loading">
            {{ submitText }}
          </BaseButton>
        </div>
        
        <div class="text-center text-sm mt-6">
          <span class="text-slate-500">{{ bottomText }}</span>
          <router-link :to="bottomLinkTo" class="ml-1.5 font-medium text-slate-900 hover:underline underline-offset-4 transition-all">
            {{ bottomLinkText }}
          </router-link>
        </div>
      </form>

    </div>
  </div>
</template>
