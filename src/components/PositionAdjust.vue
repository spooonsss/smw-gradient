<template>


<q-btn
      round
      dense
      color="primary"
      size="xs"
      icon="arrow_drop_down"
      @click="onDown"
      :disable="modelValue.start >= modelValue.position"
    />
&nbsp;
    {{value.position}}
&nbsp;
    <q-btn
      round
      dense
      color="primary"
      size="xs"
      icon="arrow_drop_up"
      @click="onUp"
      :disable="modelValue.end <= modelValue.position"
    />

</template>

<script>
import { defineComponent } from 'vue'

export default {
  props: ['modelValue', 'max'],
  emits: ['update:modelValue'],
  setup(props, ctx) {
    function onDown() {
        const newModelValue = {...props.modelValue};
        newModelValue['position']--;
        ctx.emit('update:modelValue', newModelValue)
    }
    function onUp() {
        const newModelValue = {...props.modelValue};
        newModelValue['position']++;
        ctx.emit('update:modelValue', newModelValue)
    }
    return {onDown, onUp}
  },
  computed: {
    value: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      }
    }
  }
}

</script>
