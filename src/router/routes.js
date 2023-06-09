
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: 'v1/:pathMatch(.*)*', component: () => import('pages/IndexPage.vue') },
      {
        path: '',
        redirect: to => {
          return { path: '/v1/3b8ed0/f66360' }
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
