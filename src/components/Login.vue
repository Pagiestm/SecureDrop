<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import AuthForm from './AuthForm.vue'

const router = useRouter()
const loading = ref(false)
const error = ref('')

const onSubmit = async ({ email, password }) => {
  error.value = ''
  loading.value = true
  try {
    await signInWithEmailAndPassword(auth, email, password)
    router.push('/dashboard')
  } catch (e) {
    console.error('Login failed', e)
    error.value = 'Identifiants invalides ou erreur de connexion.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthForm 
    title="Bonjour"
    subtitle="Connectez-vous à votre espace sécurisé"
    submitText="Se connecter"
    bottomText="Nouveau sur SecureDrop ?"
    bottomLinkText="Créer un compte"
    bottomLinkTo="/register"
    :error="error"
    :loading="loading"
    @submit="onSubmit"
  />
</template>
