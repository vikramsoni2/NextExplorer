<script setup>
import { reactive, computed, watch } from 'vue';
import { useAppSettings } from '@/stores/appSettings';

const appSettings = useAppSettings();

const local = reactive({ rules: [] });
const original = computed(() => appSettings.state.access.rules);
const dirty = computed(() => JSON.stringify(local.rules) !== JSON.stringify(original.value));

watch(
  () => appSettings.state.access.rules,
  (rules) => { local.rules = rules.map((r) => ({ ...r })); },
  { immediate: true },
);

const addRule = () => {
  local.rules.push({ id: String(Date.now()) + Math.random().toString(36).slice(2), path: '', recursive: true, permissions: 'ro' });
};

const removeRule = (idx) => { local.rules.splice(idx, 1); };
const reset = () => { local.rules = original.value.map((r) => ({ ...r })); };
const save = async () => {
  // basic sanitization client-side
  const cleaned = local.rules
    .map((r) => ({ ...r, path: String(r.path || '').replace(/^\/+|\/+$/g, '') }))
    .filter((r) => r.path);
  await appSettings.save({ access: { rules: cleaned } });
  local.rules = appSettings.state.access.rules.map((r) => ({ ...r }));
};
</script>

<template>
  <div class="space-y-6">
    <div v-if="dirty" class="sticky top-0 z-10 flex items-center justify-between rounded-md border border-yellow-400/30 bg-yellow-100/40 p-3 text-yellow-900 dark:border-yellow-400/20 dark:bg-yellow-500/10 dark:text-yellow-200">
      <div class="text-sm">You have unsaved changes</div>
      <div class="flex gap-2">
        <button class="rounded-md bg-yellow-500 px-3 py-1 text-black hover:bg-yellow-400" @click="save">Save</button>
        <button class="rounded-md border border-white/10 px-3 py-1 hover:bg-white/10" @click="reset">Discard</button>
      </div>
    </div>

    <section class="rounded-lg border border-white/10 bg-white/5 p-4 dark:bg-zinc-900/50">
      <h2 class="mb-2 text-base font-semibold">Folder Rules</h2>
      <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">Set per-folder permissions: read-write, read-only, or hidden.</p>

      <div class="mb-3 flex justify-end">
        <button class="rounded-md bg-blue-500 px-3 py-1 text-white hover:bg-blue-400" @click="addRule">Add rule</button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase text-neutral-500 dark:text-neutral-400">
            <tr>
              <th class="p-2">Path</th>
              <th class="p-2">Recursive</th>
              <th class="p-2">Permissions</th>
              <th class="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(rule, idx) in local.rules" :key="rule.id" class="border-t border-white/5">
              <td class="p-2">
                <input v-model="rule.path" placeholder="e.g. Pictures/Holidays" class="w-full rounded-md border border-white/10 bg-transparent px-2 py-1" />
              </td>
              <td class="p-2">
                <input type="checkbox" v-model="rule.recursive" />
              </td>
              <td class="p-2">
                <select v-model="rule.permissions" class="rounded-md border border-white/10 bg-transparent px-2 py-1">
                  <option value="rw">Read & Write</option>
                  <option value="ro">Read Only</option>
                  <option value="hidden">Hidden</option>
                </select>
              </td>
              <td class="p-2">
                <button class="rounded-md border border-white/10 px-2 py-1 text-red-400 hover:bg-white/10" @click="removeRule(idx)">Remove</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

