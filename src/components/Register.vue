<script setup>
import { ref } from 'vue'
import AuthForm from './AuthForm.vue'
import { useRouter } from 'vue-router'
import { auth, db } from '../firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

const router = useRouter()
const loading = ref(false)
const error = ref('')

const onSubmit = async ({ email, password }) => {
  error.value = ''
  loading.value = true
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const uid = userCredential.user.uid
    await setDoc(doc(db, 'users', uid), { email, uid, createdAt: serverTimestamp() })
    router.push('/dashboard')
  } catch (e) {
    console.error('Register failed', e)
    error.value = 'Erreur lors de la création de compte.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthForm
    title="Créer un compte"
    subtitle="Rejoignez la plateforme sécurisée"
    submitText="S'inscrire"
    bottomText="Déjà inscrit ?"
    bottomLinkText="Se connecter"
    bottomLinkTo="/login"
    :error="error"
    :loading="loading"
    :requireMinLength="true"
    @submit="onSubmit"
  />
</template>
