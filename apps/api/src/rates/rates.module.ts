import {Module} from '@nestjs/common'

import {createExchangeRates} from './create-rates'
import {EXCHANGE_RATES} from './exchange-rates'

@Module({
  providers: [{provide: EXCHANGE_RATES, useFactory: () => createExchangeRates(process.env)}],
  exports: [EXCHANGE_RATES]
})
export class RatesModule {}
