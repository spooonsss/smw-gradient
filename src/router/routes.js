
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: 'v1/:pathMatch(.*)*', component: () => import('pages/IndexPage.vue') },
      {
        path: '',
        redirect: to => {
          return { path: '/v1/%233b8ed0/%23f66360/0/224' }
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
