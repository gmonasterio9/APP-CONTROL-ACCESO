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
    const sede = this.sedes.find(s => s.id === this.workingSelectedId);
    if (sede) {
      this.sedeSelected.emit(sede);
    }
  }

  searchbarInput(event: Event): void {
    const query = (event as CustomEvent).detail?.value ?? '';
    this.filterList(String(query));
  }

  filterList(searchQuery: string): void {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    this.filteredSedes = this.sedes.filter(sede =>
      sede.nombre.toLowerCase().includes(normalizedQuery)
    );
  }

  checkboxChange(event: CustomEvent): void {
    const { checked, value } = event.detail as { checked: boolean; value: number };
    this.workingSelectedId = checked ? value : null;
  }

  isChecked(sedeId: number): boolean {
    return this.workingSelectedId === sedeId;
  }

  private syncFromInputs(): void {
    this.filteredSedes = [...this.sedes];
    this.workingSelectedId = this.selectedSede?.id ?? null;
  }
}
