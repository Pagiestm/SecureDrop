<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'danger', 'ghost'].includes(v)
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  icon: {
    type: Boolean,
    default: false
  }
})

const classes = computed(() => {
  const base = 'inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
  
  const size = props.icon ? 'p-2 rounded-lg' : 'px-4 py-2.5 rounded-lg text-sm'

  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm focus:ring-slate-900 border border-transparent',
    secondary: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm focus:ring-slate-200',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 focus:ring-red-500 border border-transparent',
    ghost: 'bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent focus:ring-slate-200'
  }

  return `${base} ${size} ${variants[props.variant]}`
})
</script>

<template>
  <button :class="classes" :disabled="disabled || loading">
    <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg>
    <slot></slot>
  </button>
</template>
