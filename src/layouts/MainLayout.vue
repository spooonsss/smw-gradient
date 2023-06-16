<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title>
          SMW Gradient Tool
        </q-toolbar-title>

        <div></div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      bordered
    >
    HOWTO: select start and ending colors.

    <br/><br/>
    Click on the + button or a gradient to add an intermediate color. Use Click mode: Skip Color to skip a color (best used just before exporting)

    <br/><br/>
    Mousewheel on gradient to zoom.

    <br/><br/>
    Either 1. Download .PNG and import into EffectTool (BG Gradient>Image>Load Image).
    Or 2. Select "Gradient number" then "Copy BG Code" and insert with UberASM.

    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import { defineComponent, ref } from 'vue'
//import EssentialLink from 'components/EssentialLink.vue'


export default defineComponent({
  name: 'MainLayout',

  components: {
  },

  setup () {
    const leftDrawerOpen = ref(false)

    return {
      leftDrawerOpen,
      toggleLeftDrawer () {
        leftDrawerOpen.value = !leftDrawerOpen.value
      }
    }
  }
})
</script>
