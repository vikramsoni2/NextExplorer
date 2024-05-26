

<template>
  <h1>File Editor</h1>
  <div class="w-full overflow-scroll">
   
    <Codemirror
    v-model="fileContent"
    placeholder="Code goes here..."
    :style="{ height: 'calc(100vh - 100px)' }"
    :autofocus="true"
    :extensions="extensions"
    @ready="handleReady"
    @change="log('change', $event)"
    @focus="log('focus', $event)"
    @blur="log('blur', $event)"
  />
    
  </div>
</template>

<script setup>
import { ref, onMounted, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { Codemirror } from 'vue-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

const route = useRoute();

const fileContent = ref('');
const extensions = [javascript(), oneDark]

// Codemirror EditorView instance ref
const view = shallowRef()
const handleReady = (payload) => {
    view.value = payload.view
}


const fetchFileContent = async () => {
  const { path } = route.params;
  try {
    const response = await axios.post('http://localhost:3000/api/editor', { path });
    fileContent.value = response.data.content;
  } catch (error) {
    console.error('Failed to fetch file content:', error);
    fileContent.value = 'Error loading file content.';
  }
};

const log = console.log

onMounted(fetchFileContent);
</script>

