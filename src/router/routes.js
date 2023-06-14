
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: 'v1/:pathMatch(.*)*', component: () => import('pages/IndexPage.vue') },
      {
        path: '',
        redirect: to => {
          return { path: '/v1/f66363-0_3b8edb-224/1' }
        },
      },
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
