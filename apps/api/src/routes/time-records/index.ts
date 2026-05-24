import { Hono } from 'hono'
import type { AppEnv } from '../../types.js'
import { breakEndRoute } from './break-end.js'
import { breakStartRoute } from './break-start.js'
import { clockInRoute } from './clock-in.js'
import { clockOutRoute } from './clock-out.js'
import { listRoute } from './list.js'
import { switchTypeRoute } from './switch-type.js'
import { todayRoute } from './today.js'

export const timeRecordsRouter = new Hono<AppEnv>()
  .route('/today', todayRoute)
  .route('/clock-in', clockInRoute)
  .route('/clock-out', clockOutRoute)
  .route('/break-start', breakStartRoute)
  .route('/break-end', breakEndRoute)
  .route('/switch-type', switchTypeRoute)
  .route('/', listRoute)
