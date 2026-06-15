import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Sede } from '../../../../../core/models/sede.model';

@Component({
  selector: 'app-sedes-modal',
  templateUrl: './sedes-modal.component.html',
  styleUrls: ['./sedes-modal.component.scss'],
  standalone: false,
})
export class SedesModalComponent implements OnChanges {
  @Input() sedes: Sede[] = [];
  @Input() selectedSede: Sede | null = null;

  @Output() sedeSelected = new EventEmitter<Sede>();
  @Output() cancelled = new EventEmitter<void>();

  filteredSedes: Sede[] = [];
  workingSelectedId: number | null = null;
  searchQuery = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sedes'] || changes['selectedSede']) {
      this.syncFromInputs();
    }
  }

  trackSede(_index: number, sede: Sede): number {
    return sede.id;
  }

  cancel(): void {
    this.cancelled.emit();
  }

  confirm(): void {
    const sede = this.sedeSeleccionada;
    if (sede) {
      this.sedeSelected.emit(sede);
    }
  }

  selectSede(sede: Sede): void {
    this.workingSelectedId = this.workingSelectedId === sede.id ? null : sede.id;
  }

  searchbarInput(event: Event): void {
    const query = (event as CustomEvent).detail?.value ?? '';
    this.filterList(String(query));
  }

  filterList(searchQuery: string): void {
    this.searchQuery = searchQuery;
    const normalizedQuery = this.normalizarBusqueda(searchQuery);

    if (!normalizedQuery) {
      this.filteredSedes = [...this.sedes];
      return;
    }

    this.filteredSedes = this.sedes.filter(sede =>
      this.normalizarBusqueda(sede.nombre).includes(normalizedQuery)
    );
  }

  isChecked(sedeId: number): boolean {
    return this.workingSelectedId === sedeId;
  }

  get sedeSeleccionada(): Sede | null {
    if (this.workingSelectedId === null) {
      return null;
    }

    return this.sedes.find(s => s.id === this.workingSelectedId) ?? null;
  }

  get seleccionVisibleEnFiltro(): boolean {
    const sede = this.sedeSeleccionada;
    if (!sede) {
      return false;
    }

    return this.filteredSedes.some(s => s.id === sede.id);
  }

  get puedeConfirmar(): boolean {
    return this.sedeSeleccionada !== null;
  }

  private normalizarBusqueda(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  private syncFromInputs(): void {
    this.searchQuery = '';
    this.filteredSedes = [...this.sedes];
    this.workingSelectedId = this.selectedSede?.id ?? null;
  }
}
