import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output, signal, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DfMedia } from '@design-factory/design-factory';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { O3rComponent } from '@o3r/core';

const FILTER_PAG_REGEX = /[^0-9]/g;

@O3rComponent({ componentType: 'Component' })
@Component({
  selector: 'app-defered-pres',
  standalone: true,
  imports: [NgbPaginationModule, FormsModule],
  templateUrl: './defered-pres.template.html',
  styleUrl: './defered-pres.style.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeferedPresComponent {

  @Input()
  public totalPetsAmount?: number;

  private mediaService = inject(DfMedia);

  /**
   * Currently opened page on the table
   */
  public currentPage = signal(1);

  /**
   * Number of items to display on a table page
   */
  public pageSize = signal(10);

  @Output()
  public pageSizeChanged: EventEmitter<number> = new EventEmitter();

  @Output()
  public currentPageChanged: EventEmitter<number> = new EventEmitter();

  /**
   * True if screen size is 'xs' or 'sm'
   */
  public isSmallScreen = toSignal<boolean>(this.mediaService.getObservable(['xs', 'sm']));

  public formatPaginationInput(input: HTMLInputElement) {
    input.value = input.value.replace(FILTER_PAG_REGEX, '');
  }
}
