<template>

  <q-slider v-model="value.position" :min="0" :max="224" :inner-min="value.start" :inner-max="value.end"/>
  <q-color v-model="color" />

</template>

<script>
import { defineComponent } from 'vue'

export default {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  computed: {
    color: {
        get() {
            return '#' + this.modelValue.color;
        },
        set(value) {
            this.value.color = value.substring(1);
        }
    },

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
