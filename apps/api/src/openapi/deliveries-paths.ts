import {AdminDeliverySchema} from '@shop/shared/delivery'

import {type Method, type Operation, guarded, json, pathParam} from './helpers'

const op = (o: Omit<Operation, 'tags'>): Operation => ({...o, tags: ['Deliveries admin']})
const notStuck = {
  '409': {
    description:
      '`delivery_not_stuck`: the delivery is not `FAILED` or `NEEDS_REVIEW` (it may have moved on since you looked)'
  }
}

export const deliveriesPaths: Record<string, Partial<Record<Method, Operation>>> = {
  '/api/admin/deliveries/{id}/retry': {
    post: op({
      operationId: 'retryDelivery',
      summary: 'Run a stuck delivery again',
      description:
        'Needs `delivery.resolve`. Only a `FAILED` or `NEEDS_REVIEW` delivery: it goes back to `PENDING` with `attempts` reset to 0 and is queued at once. The commands already confirmed (`commandsDone`) are not sent again, and the last error is kept until the next outcome. Audited as `delivery.retry`.',
      parameters: [pathParam('id')],
      responses: {
        '201': json('The delivery, now `PENDING`', AdminDeliverySchema),
        '404': {description: '`not_found`: no such delivery'},
        '409': {
          description: `${notStuck['409'].description}; \`delivery_not_retryable\`: the delivery has no commands because the nick could not be used (\`lastError\` \`invalid_nick\`), so running it again would send nothing; give the purchase by hand and use mark-done`
        },
        ...guarded
      }
    })
  },
  '/api/admin/deliveries/{id}/mark-done': {
    post: op({
      operationId: 'markDeliveryDone',
      summary: 'Confirm a stuck delivery by hand',
      description:
        'Needs `delivery.resolve`. Only a `FAILED` or `NEEDS_REVIEW` delivery, for when the owner has given the purchase in game. The delivery becomes `DONE`, a timed product starts or extends its clock, and an order whose deliveries are all done becomes `DELIVERED`. Nothing is sent to the server. Audited as `delivery.mark_done`.',
      parameters: [pathParam('id')],
      responses: {
        '201': json('The delivery, now `DONE`', AdminDeliverySchema),
        '404': {description: '`not_found`: no such delivery'},
        ...notStuck,
        ...guarded
      }
    })
  }
}
