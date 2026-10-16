import {Global, Module} from '@nestjs/common'

import {createPaymentsGateway} from './create-gateway'
import {PAYMENTS_GATEWAY} from './payments-gateway'

@Global()
@Module({
  providers: [{provide: PAYMENTS_GATEWAY, useFactory: () => createPaymentsGateway(process.env)}],
  exports: [PAYMENTS_GATEWAY]
})
export class PaymentsModule {}
