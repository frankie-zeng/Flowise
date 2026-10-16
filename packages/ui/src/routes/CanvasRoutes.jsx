import { lazy } from 'react'
import { Navigate } from 'react-router'

// project imports
import Loadable from '@/ui-component/loading/Loadable'
import MinimalLayout from '@/layout/MinimalLayout'
import { RequireAuth } from '@/routes/RequireAuth'

// canvas routing
const CanvasV2 = Loadable(lazy(() => import('@/views/agentflowsv2/Canvas')))
const MarketplaceCanvasV2 = Loadable(lazy(() => import('@/views/agentflowsv2/MarketplaceCanvas')))

// ==============================|| CANVAS ROUTING ||============================== //

const CanvasRoutes = {
    path: '/',
    element: <MinimalLayout />,
    children: [
        {
            path: '/canvas',
            element: <Navigate to='/agentflows' replace />
        },
        {
            path: '/canvas/:id',
            element: <Navigate to='/agentflows' replace />
        },
        {
            path: '/agentcanvas',
            element: <Navigate to='/agentflows' replace />
        },
        {
            path: '/agentcanvas/:id',
            element: <Navigate to='/agentflows' replace />
        },
        {
            path: '/v2/agentcanvas',
            element: (
                <RequireAuth permission={'agentflows:view'}>
                    <CanvasV2 />
                </RequireAuth>
            )
        },
        {
            path: '/v2/agentcanvas/:id',
            element: (
                <RequireAuth permission={'agentflows:view'}>
                    <CanvasV2 />
                </RequireAuth>
            )
        },
        {
            path: '/marketplace/:id',
            element: <Navigate to='/marketplaces' replace />
        },
        {
            path: '/v2/marketplace/:id',
            element: (
                <RequireAuth permission={'templates:marketplace,templates:custom'}>
                    <MarketplaceCanvasV2 />
                </RequireAuth>
            )
        }
    ]
}

export default CanvasRoutes
