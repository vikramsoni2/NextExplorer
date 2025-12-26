<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  permissions: {
    type: Object,
    default: null,
  },
  isDirectory: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['change-permissions', 'change-owner']);

// Individual permission flags (read, write, execute)
const ownerRead = ref(true);
const ownerWrite = ref(true);
const ownerExecute = ref(false);

const groupRead = ref(true);
const groupWrite = ref(false);
const groupExecute = ref(false);

const othersRead = ref(true);
const othersWrite = ref(false);
const othersExecute = ref(false);

const applyToItems = ref(false);

// Track original permissions to detect changes
const originalOctal = ref('644');

// Convert octal digit to read/write/execute flags
const octalToFlags = (octal) => {
  const num = parseInt(octal, 8);
  return {
    read: (num & 4) !== 0,
    write: (num & 2) !== 0,
    execute: (num & 1) !== 0,
  };
};

// Convert read/write/execute flags to octal digit
const flagsToOctal = (read, write, execute) => {
  return (read ? 4 : 0) + (write ? 2 : 0) + (execute ? 1 : 0);
};

// Watch for permissions prop changes
watch(
  () => props.permissions,
  (newPerms) => {
    if (newPerms && newPerms.mode) {
      // Convert mode to octal string, then get last 3 digits
      const mode = newPerms.mode.toString(8); // Convert to octal base
      const perms = mode.slice(-3);

      // Store original
      originalOctal.value = perms;

      const owner = octalToFlags(perms[0]);
      ownerRead.value = owner.read;
      ownerWrite.value = owner.write;
      ownerExecute.value = owner.execute;

      const group = octalToFlags(perms[1]);
      groupRead.value = group.read;
      groupWrite.value = group.write;
      groupExecute.value = group.execute;

      const others = octalToFlags(perms[2]);
      othersRead.value = others.read;
      othersWrite.value = others.write;
      othersExecute.value = others.execute;
    }
  },
  { immediate: true },
);

const currentOctal = computed(() => {
  const owner = flagsToOctal(
    ownerRead.value,
    ownerWrite.value,
    ownerExecute.value,
  );
  const group = flagsToOctal(
    groupRead.value,
    groupWrite.value,
    groupExecute.value,
  );
  const others = flagsToOctal(
    othersRead.value,
    othersWrite.value,
    othersExecute.value,
  );
  return `${owner}${group}${others}`;
});

const hasChanges = computed(() => {
  return currentOctal.value !== originalOctal.value;
});

const applyChanges = () => {
  emit('change-permissions', {
    mode: currentOctal.value,
    recursive: applyToItems.value,
  });
};

// Owner/Group editing
const editingOwner = ref(false);
const editingGroup = ref(false);
const newOwner = ref('');
const newGroup = ref('');

const startEditOwner = () => {
  newOwner.value = props.permissions?.owner || '';
  editingOwner.value = true;
};

const startEditGroup = () => {
  newGroup.value = props.permissions?.group || '';
  editingGroup.value = true;
};

const saveOwner = () => {
  if (newOwner.value && newOwner.value !== props.permissions?.owner) {
    emit('change-owner', { owner: newOwner.value });
  }
  editingOwner.value = false;
};

const saveGroup = () => {
  if (newGroup.value && newGroup.value !== props.permissions?.group) {
    emit('change-owner', { group: newGroup.value });
  }
  editingGroup.value = false;
};

const cancelEditOwner = () => {
  editingOwner.value = false;
  newOwner.value = '';
};

const cancelEditGroup = () => {
  editingGroup.value = false;
  newGroup.value = '';
};
</script>

<template>
  <div class="space-y-4 pt-4 border-t border-neutral-200 dark:border-white/5">
    <div class="flex items-center justify-between">
      <p
        class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
      >
        Sharing & Permissions
      </p>
      <p
        v-if="permissions?.mode"
        class="text-xs font-mono text-neutral-500 dark:text-neutral-400"
      >
        {{ currentOctal }}
      </p>
    </div>

    <div v-if="loading" class="text-sm text-neutral-500 dark:text-neutral-400">
      Loading permissions...
    </div>

    <div
      v-else-if="!permissions"
      class="text-sm text-neutral-500 dark:text-neutral-400"
    >
      Unable to load permissions
    </div>

    <template v-else>
      <!-- Owner & Group Info -->
      <div
        class="space-y-2 pb-3 border-b border-neutral-200 dark:border-white/5"
      >
        <!-- Owner -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-neutral-600 dark:text-neutral-400"
            >Owner</span
          >
          <div v-if="editingOwner" class="flex items-center gap-1">
            <input
              v-model="newOwner"
              type="text"
              class="px-2 py-0.5 text-sm bg-white dark:bg-zinc-800 border border-neutral-300 dark:border-white/10 rounded"
              @keyup.enter="saveOwner"
              @keyup.escape="cancelEditOwner"
            />
            <button
              @click="saveOwner"
              class="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              @click="cancelEditOwner"
              class="px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Cancel
            </button>
          </div>
          <button
            v-else
            @click="startEditOwner"
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {{ permissions.owner || 'Unknown' }}
          </button>
        </div>

        <!-- Group -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-neutral-600 dark:text-neutral-400"
            >Group</span
          >
          <div v-if="editingGroup" class="flex items-center gap-1">
            <input
              v-model="newGroup"
              type="text"
              class="px-2 py-0.5 text-sm bg-white dark:bg-zinc-800 border border-neutral-300 dark:border-white/10 rounded"
              @keyup.enter="saveGroup"
              @keyup.escape="cancelEditGroup"
            />
            <button
              @click="saveGroup"
              class="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              @click="cancelEditGroup"
              class="px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Cancel
            </button>
          </div>
          <button
            v-else
            @click="startEditGroup"
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {{ permissions.group || 'Unknown' }}
          </button>
        </div>
      </div>

      <!-- Permissions Grid -->
      <div class="space-y-2">
        <!-- Header Row -->
        <div
          class="grid grid-cols-4 gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 pb-1 border-b border-neutral-200 dark:border-white/5"
        >
          <div></div>
          <div class="text-center">Read</div>
          <div class="text-center">Write</div>
          <div class="text-center">Execute</div>
        </div>

        <!-- Owner Row -->
        <div class="grid grid-cols-4 gap-2 items-center py-1">
          <div class="text-sm text-neutral-700 dark:text-neutral-300 truncate">
            Owner
          </div>
          <div class="flex justify-center">
            <input
              v-model="ownerRead"
              type="checkbox"
              class="h-4 w-4 rounded border-neutral-300 dark:border-white/10 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div class="flex justify-center">
            <input
              v-model="ownerWrite"
              type="checkbox"
              class="h-4 w-4 rounded border-neutral-300 dark:border-white/10 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div class="flex justify-center">
            <input
              v-model="ownerExecute"
              type="checkbox"
              class="h-4 w-4 rounded border-neutral-300 dark:border-white/10 text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>

        <!-- Group Row -->
        <div class="grid grid-cols-4 gap-2 items-center py-1">
          <div class="text-sm text-neutral-700 dark:text-neutral-300 truncate">
            Group
          </div>
          <div class="flex justify-center">
            <input
              v-model="groupRead"
              type="checkbox"
              class="h-4 w-4 rounded border-neutral-300 dark:border-white/10 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div class="flex justify-center">
            <input
              v-model="groupWrite"
              type="checkbox"
              class="h-4 w-4 rounded border-neutral-300 dark:border-white/10 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div class="flex justify-center">
            <input
              v-model="groupExecute"
              type="checkbox"
              class="h-4 w-4 rounded border-neutral-300 dark:border-white/10 text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>

        <!-- Others Row -->
        <div class="grid grid-cols-4 gap-2 items-center py-1">
          <div class="text-sm text-neutral-700 dark:text-neutral-300">
            Everyone
          </div>
          <div class="flex justify-center">
            <input
              v-model="othersRead"
              type="checkbox"
              class="h-4 w-4 rounded border-neutral-300 dark:border-white/10 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div class="flex justify-center">
            <input
              v-model="othersWrite"
              type="checkbox"
              class="h-4 w-4 rounded border-neutral-300 dark:border-white/10 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div class="flex justify-center">
            <input
              v-model="othersExecute"
              type="checkbox"
              class="h-4 w-4 rounded border-neutral-300 dark:border-white/10 text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <!-- Apply to items checkbox for directories -->
      <div
        v-if="isDirectory"
        class="flex items-center gap-2 pt-3 border-t border-neutral-200 dark:border-white/5"
      >
        <input
          id="apply-to-items"
          v-model="applyToItems"
          type="checkbox"
          class="h-4 w-4 rounded border-neutral-300 dark:border-white/10 text-blue-600 focus:ring-blue-500"
        />
        <label
          for="apply-to-items"
          class="text-sm text-neutral-700 dark:text-neutral-300"
        >
          Apply to enclosed items
        </label>
      </div>

      <!-- Apply button (only shows when changes detected) -->
      <button
        v-if="hasChanges"
        @click="applyChanges"
        class="w-full mt-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
      >
        Apply
      </button>
    </template>
  </div>
</template>
