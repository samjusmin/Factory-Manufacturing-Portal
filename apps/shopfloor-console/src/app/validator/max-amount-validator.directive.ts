/* https://www.concretepage.com/angular-2/angular-4-min-max-validation */

import { Directive, Input } from '@angular/core';
import { NG_VALIDATORS, Validator, FormControl } from '@angular/forms';

@Directive({
  selector: '[maxAmount][formControlName],[maxAmount][formControl],[maxAmount][ngModel]',
  providers: [{provide: NG_VALIDATORS, useExisting: MaxAmountDirective, multi: true}]
})
export class MaxAmountDirective implements Validator {
  @Input()
  maxAmount: number;
  
  validate(c: FormControl): {[key: string]: any} {
      let v = parseInt(c.value);
      return ( v > this.maxAmount && !isNaN(+v))? {"maxAmount": true} : null;
  }
} 