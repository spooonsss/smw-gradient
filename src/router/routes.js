
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: 'v1/:pathMatch(.*)*',
        redirect: to => {
          return { path: '/v2/' + to.fullPath.substring(4) + '/224' }
        },
      },
      { path: 'v2/:pathMatch(.*)*',
        redirect: to => {
          return { path: '/v3/' + to.fullPath.substring(4) + '/1' }
        },
      },
      { path: 'v3/:pathMatch(.*)*',
        redirect: to => {
          return { path: '/v4/' + to.fullPath.substring(4) + '/-1' }
        },
      },
      { path: 'v4/:pathMatch(.*)*', component: () => import('pages/IndexPage.vue') },
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
