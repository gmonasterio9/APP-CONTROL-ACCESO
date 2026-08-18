import { Component, Input } from '@angular/core';

export interface ToqueEnfoque {
  x: number;
  y: number;
}

@Component({
  selector: 'app-scanner-enfoque',
  templateUrl: 'scanner-enfoque.component.html',
  styleUrls: ['scanner-enfoque.component.scss'],
  standalone: false,
})
export class ScannerEnfoqueComponent {
  @Input() toque: ToqueEnfoque | null = null;
}
