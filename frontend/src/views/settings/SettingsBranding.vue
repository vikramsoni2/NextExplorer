<script setup>
import { computed, reactive, watch, ref } from 'vue';
import { useAppSettings } from '@/stores/appSettings';
import { useI18n } from 'vue-i18n';

const appSettings = useAppSettings();
const { t } = useI18n();

const local = reactive({
  appName: 'Explorer',
  showPoweredBy: false,
});

const logoPreviewUrl = ref('/logo.svg');
const isUploading = ref(false);
const uploadMessage = ref('');
const uploadMessageType = ref(''); // 'success' or 'error'
const fileInputRef = ref(null);

const original = computed(() => appSettings.state.branding);
const dirty = computed(
  () =>
    local.appName !== original.value.appName ||
    logoPreviewUrl.value !== original.value.appLogoUrl ||
    local.showPoweredBy !== original.value.showPoweredBy
);

watch(
  () => appSettings.state.branding,
  (b) => {
    local.appName = b.appName;
    logoPreviewUrl.value = b.appLogoUrl;
    local.showPoweredBy = b.showPoweredBy || false;
  },
  { immediate: true }
);

const reset = () => {
  const b = appSettings.state.branding;
  local.appName = b.appName;
  logoPreviewUrl.value = b.appLogoUrl;
  local.showPoweredBy = b.showPoweredBy || false;
};

const save = async () => {
  try {
    await appSettings.save({
      branding: {
        appName: local.appName,
        appLogoUrl: logoPreviewUrl.value,
        showPoweredBy: local.showPoweredBy,
      },
    });
    uploadMessage.value = 'Branding saved successfully!';
    uploadMessageType.value = 'success';
    setTimeout(() => {
      uploadMessage.value = '';
      uploadMessageType.value = '';
    }, 3000);
  } catch (error) {
    uploadMessage.value = `Failed to save: ${error.message}`;
    uploadMessageType.value = 'error';
  }
};

const handleLogoSelect = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file size (2MB max)
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    uploadMessage.value = t('settings.branding.logoError') || 'File must be smaller than 2MB';
    uploadMessageType.value = 'error';
    return;
  }

  // Validate file type
  const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg'];
  if (!validTypes.includes(file.type)) {
    uploadMessage.value = t('settings.branding.invalidFileType') || 'Please upload SVG, PNG, or JPG';
    uploadMessageType.value = 'error';
    return;
  }

  isUploading.value = true;
  uploadMessage.value = 'Uploading...';
  uploadMessageType.value = '';

  try {
    console.log('Starting file upload:', {
      filename: file.name,
      size: file.size,
      type: file.type,
    });

    // Upload file to backend
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch('/api/settings/upload-logo', {
      method: 'POST',
      body: formData,
    });

    console.log('Upload response status:', response.status);
    
    const data = await response.json();
    console.log('Upload response data:', data);

    if (!response.ok) {
      throw new Error(data.error || `Upload failed: ${response.statusText}`);
    }

    if (data.logoUrl) {
      logoPreviewUrl.value = data.logoUrl;
      uploadMessage.value = t('settings.branding.uploadSuccess') || 'Logo uploaded successfully!';
      uploadMessageType.value = 'success';
      
      console.log('Logo uploaded successfully:', data.logoUrl);
      
      // Auto clear message after 3 seconds
      setTimeout(() => {
        uploadMessage.value = '';
        uploadMessageType.value = '';
      }, 3000);
    } else {
      throw new Error('No logo URL returned from server');
    }
  } catch (error) {
    console.error('Logo upload error:', error);
    uploadMessage.value = `Upload failed: ${error.message}`;
    uploadMessageType.value = 'error';
  } finally {
    isUploading.value = false;
    // Clear the input so the same file can be selected again
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
};

const triggerFileInput = () => {
  fileInputRef.value?.click();
};
</script>

<template>
  <div class="space-y-6">
    <!-- Upload Message Alert -->
    <div
      v-if="uploadMessage"
      :class="[
        'rounded-md border p-3 text-sm',
        uploadMessageType === 'success'
          ? 'border-green-400/30 bg-green-100/40 text-green-900 dark:border-green-400/20 dark:bg-green-500/10 dark:text-green-200'
          : 'border-red-400/30 bg-red-100/40 text-red-900 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200'
      ]"
    >
      {{ uploadMessage }}
    </div>

    <div
      v-if="dirty"
      class="sticky top-0 z-10 flex items-center justify-between rounded-md border border-yellow-400/30 bg-yellow-100/40 p-3 text-yellow-900 dark:border-yellow-400/20 dark:bg-yellow-500/10 dark:text-yellow-200"
    >
      <div class="text-sm">{{ t('common.unsavedChanges') }}</div>
      <div class="flex gap-2">
        <button
          class="rounded-md bg-yellow-500 px-3 py-1 text-black hover:bg-yellow-400"
          @click="save"
        >
          {{ t('common.save') }}
        </button>
        <button
          class="rounded-md border border-white/10 px-3 py-1 hover:bg-white/10"
          @click="reset"
        >
          {{ t('common.discard') }}
        </button>
      </div>
    </div>

    <section class="rounded-lg p-4">
      <h2 class="mb-2 text-base font-semibold">{{ t('titles.branding') || 'Branding' }}</h2>
      <p class="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        {{ t('settings.branding.subtitle') || 'Customize the application name and logo' }}
      </p>

      <div class="space-y-6">
        <!-- App Name -->
        <div class="border-b border-neutral-200 pb-6 dark:border-neutral-700">
          <div class="mb-3">
            <label class="block text-sm font-medium">
              {{ t('settings.branding.appName') || 'Application Name' }}
            </label>
            <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('settings.branding.appNameHelp') || 'The name displayed in the header and login page' }}
            </p>
          </div>
          <input
            v-model="local.appName"
            type="text"
            maxlength="100"
            placeholder="Explorer"
            class="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <p class="mt-2 text-xs text-neutral-400">
            {{ local.appName.length }}/100
          </p>
        </div>

        <!-- Logo Upload -->
        <div>
          <div class="mb-3">
            <label class="block text-sm font-medium">
              {{ t('settings.branding.logo') || 'Logo Image' }}
            </label>
            <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('settings.branding.logoHelp') || 'Upload SVG, PNG, or JPG file for your custom logo' }}
            </p>
          </div>

          <!-- Hidden file input -->
          <input
            ref="fileInputRef"
            type="file"
            accept=".svg,.png,.jpg,.jpeg"
            style="display: none"
            @change="handleLogoSelect"
          />

          <!-- Upload button -->
          <button
            :disabled="isUploading"
            class="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="triggerFileInput"
          >
            <span v-if="!isUploading">{{ t('common.select') || 'Select Logo' }}</span>
            <span v-else>{{ t('settings.branding.uploading') || 'Uploading...' }}</span>
          </button>

           <!-- Preview -->
           <div class="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/50">
             <p class="mb-3 text-xs font-medium text-neutral-600 dark:text-neutral-300">
               {{ t('settings.branding.preview') || 'Preview' }}
             </p>
             <div class="flex items-center gap-3">
               <img
                 :src="logoPreviewUrl"
                 :alt="local.appName + ' logo'"
                 class="h-10 w-auto"
                 @error="$event.target.style.display = 'none'"
               />
               <span class="text-lg font-bold">{{ local.appName }}</span>
             </div>
           </div>

           <!-- Powered By Checkbox -->
           <div class="mt-6">
             <label class="flex items-center gap-3 cursor-pointer">
               <input
                 v-model="local.showPoweredBy"
                 type="checkbox"
                 class="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600"
               />
               <div>
                 <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                   {{ t('settings.branding.showPoweredBy') || 'Show Powered by NextExplorer' }}
                 </span>
                 <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                   {{ t('settings.branding.showPoweredByHelp') || 'Display a link to NextExplorer in the footer' }}
                 </p>
               </div>
             </label>
           </div>
         </div>
      </div>
    </section>
  </div>
</template>
