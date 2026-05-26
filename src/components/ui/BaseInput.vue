<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  },
  placeholder: {
    type: String,
    default: ''
  },
  required: {
    type: Boolean,
    default: false
  },
  minlength: {
    type: [String, Number],
    default: null
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const onInput = (event) => {
  emit('update:modelValue', event.target.value)
}

const id = computed(() => `input-${Math.random().toString(36).substr(2, 9)}`)
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="block text-sm font-medium text-slate-700 mb-1.5">
      {{ label }}
    </label>
    <input 
      :id="id"
      :type="type"
      :value="modelValue"
      @input="onInput"
      :placeholder="placeholder"
      :required="required"
      :minlength="minlength"
      :readonly="readonly"
      class="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 focus:bg-white transition-colors sm:text-sm"
      :class="{ 'opacity-60 cursor-not-allowed bg-slate-100': readonly }"
    />
  </div>
</template>
