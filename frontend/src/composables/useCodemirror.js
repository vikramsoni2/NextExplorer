import { markRaw, onMounted, reactive, toRefs, unref } from 'vue';

import CodeMirror from 'codemirror';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/theme/ambiance.css';
import 'codemirror/theme/material.css';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/lint.css';

export default function useCodeMirror({
  emit,
  initialValue = '',
  options = {},
  textareaRef,
}) {
  const state = reactive({
    cm: null,
    dirty: null,
    generation: null,
  });

  const hasErrors = () => !!state.cm.state.lint.marked.length;

  const setValue = (val) => {
    state.cm.setValue(val);
    state.generation = state.cm.doc.changeGeneration(true);
    state.cm.markClean();
    state.dirty = false;
  };

  const append = (val) => {
    state.cm.doc.replaceRange(val, { line: Infinity });
  };

  const initialize = () => {
    // CodeMirror.registerHelper("lint", options.mode, function (text) {
    //   return options.lint.getAnnotations;
    // });

    // create code mirror instance
    state.cm = markRaw(
      CodeMirror.fromTextArea(textareaRef.value, {
        ...unref(options),
      }),
    );

    // initialize editor with initial value
    state.cm.setValue(initialValue);

    // mark clean and prep for change tracking
    state.generation = state.cm.doc.changeGeneration(true);
    state.dirty = !state.cm.doc.isClean(state.generation);

    // synchronize with state (if dirty)
    state.cm.on('change', (cm) => {
      state.dirty = !state.cm.doc.isClean(state.generation);
      emit('change', { value: cm.getValue() });
    });
  };

  onMounted(() => initialize());

  const { cm: editor, ...rest } = toRefs(state);

  return {
    ...rest,
    append,
    editor,
    hasErrors,
    setValue,
  };
}
