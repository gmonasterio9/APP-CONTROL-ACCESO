import { Injectable } from '@angular/core';
import {
  Observable,
  catchError,
  forkJoin,
  from,
  map,
  of,
  switchMap,
} from 'rxjs';
import { EstacionamientoDisponibilidadResponse } from '../models/estacionamiento-disponibilidad.model';
import {
  EstacionamientoListResponse,
  EstacionamientoCard,
} from '../models/estacionamiento.model';
import { VehiculosActivosResponse } from '../models/estacionamiento-vehiculos.model';
import {
  OFFLINE_CATALOGO_STORAGE_KEY,
  OfflineCatalogoAccesoResponse,
  OfflineCatalogoAccesoView,
  OfflineEstacionamientoDetalleCache,
  buildEstacionamientoDisponibilidadCacheUrl,
  buildEstacionamientoVehiculosCacheUrl,
  buildEstacionamientosCacheUrl,
  buildPeatonalDetalleCacheUrl,
  buildPeatonalResumenCacheUrl,
  mapDetallePeatonalDesdeApi,
  mapDisponibilidadEstacionamientoDesdeApi,
  mapEstacionamientosDesdeApi,
  mapOfflineCatalogo,
  mapResumenPeatonalDesdeApi,
  mapVehiculosActivosEstacionamientoDesdeApi,
  resolverEstacionamientoDesdeCatalogo,
} from '../models/offline-catalogo.model';
import { LoginEstacionamientoSesion } from '../models/login-sesion.model';
import {
  PeatonalDetalleResponse,
  PeatonalDetalleView,
} from '../models/peatonal-detalle.model';
import {
  PeatonalResumenResponse,
  PeatonalResumenView,
} from '../models/peatonal-resumen.model';
import { OfflineValidacionUtil } from '../utils/offline-validacion.util';
import { ApiHttpService } from './api-http.service';
import { AppStorageService } from './app-storage.service';
import { NetworkService } from './network.service';

@Injectable({ providedIn: 'root' })
export class OfflineService {
  constructor(
    private api: ApiHttpService,
    private storage: AppStorageService,
    private network: NetworkService
  ) {}

  sincronizarCatalogoAcceso(
    estacionamientoSesion?: LoginEstacionamientoSesion | null
  ): Observable<OfflineCatalogoAccesoView> {
    return this.api
      .get<OfflineCatalogoAccesoResponse>('/offline/catalogo-acceso')
      .pipe(
        map(res => this.completarCatalogo(mapOfflineCatalogo(res), estacionamientoSesion)),
        switchMap(catalogo =>
          forkJoin({
            resumen: this.api
              .get<PeatonalResumenResponse>(buildPeatonalResumenCacheUrl())
              .pipe(
                map(mapResumenPeatonalDesdeApi),
                catchError(() => of(null as PeatonalResumenView | null))
              ),
            detalle: this.api
              .get<PeatonalDetalleResponse>(buildPeatonalDetalleCacheUrl())
              .pipe(
                map(mapDetallePeatonalDesdeApi),
                catchError(() => of(null as PeatonalDetalleView | null))
              ),
            estacionamientos: this.api
              .get<EstacionamientoListResponse>(buildEstacionamientosCacheUrl())
              .pipe(
                map(mapEstacionamientosDesdeApi),
                catchError(() => of(null as EstacionamientoCard[] | null))
              ),
          }).pipe(
            switchMap(({ resumen, detalle, estacionamientos }) =>
              this.cargarDetallesEstacionamientos(estacionamientos ?? []).pipe(
                map(estacionamientosDetalle => ({
                  ...catalogo,
                  resumenPeatonal: resumen ?? undefined,
                  detallePeatonal: detalle ?? undefined,
                  estacionamientos: estacionamientos ?? undefined,
                  estacionamientosDetalle,
                }))
              )
            )
          )
        ),
        switchMap(catalogo =>
          from(this.persistirCatalogo(catalogo)).pipe(map(() => catalogo))
        )
      );
  }

  async getCatalogo(): Promise<OfflineCatalogoAccesoView | null> {
    return this.storage.get<OfflineCatalogoAccesoView>(
      OFFLINE_CATALOGO_STORAGE_KEY
    );
  }

  async getEstacionamientoOffline(): Promise<LoginEstacionamientoSesion | null> {
    const catalogo = await this.getCatalogo();
    return resolverEstacionamientoDesdeCatalogo(catalogo);
  }

  async getResumenPeatonalOffline(): Promise<PeatonalResumenView | null> {
    const catalogo = await this.getCatalogo();
    return catalogo?.resumenPeatonal ?? null;
  }

  async getDetallePeatonalOffline(): Promise<PeatonalDetalleView | null> {
    const catalogo = await this.getCatalogo();
    return catalogo?.detallePeatonal ?? null;
  }

  async getEstacionamientosOffline(): Promise<EstacionamientoCard[]> {
    const catalogo = await this.getCatalogo();
    return catalogo?.estacionamientos ?? [];
  }

  async getEstacionamientoDetalleOffline(
    aeseNcorr: number
  ): Promise<OfflineEstacionamientoDetalleCache | null> {
    const catalogo = await this.getCatalogo();
    return catalogo?.estacionamientosDetalle?.[aeseNcorr] ?? null;
  }

  /** Sin internet y con catálogo local sincronizado en el último login. */
  async debeUsarModoOffline(): Promise<boolean> {
    const hayInternet = await this.network.hayInternet();
    if (hayInternet) {
      return false;
    }
    const catalogo = await this.getCatalogo();
    return (
      OfflineValidacionUtil.tieneCatalogoValidacion(catalogo) ||
      !!catalogo?.estacionamiento?.ingresoManual
    );
  }

  async clearCatalogo(): Promise<void> {
    await this.storage.remove(OFFLINE_CATALOGO_STORAGE_KEY);
  }

  private completarCatalogo(
    catalogo: OfflineCatalogoAccesoView,
    estacionamientoSesion?: LoginEstacionamientoSesion | null
  ): OfflineCatalogoAccesoView {
    return {
      ...catalogo,
      estacionamiento: catalogo.estacionamiento ?? estacionamientoSesion ?? undefined,
      personas: catalogo.personas ?? [],
      patentes: catalogo.patentes ?? [],
    };
  }

  private cargarDetallesEstacionamientos(
    estacionamientos: EstacionamientoCard[]
  ): Observable<Record<number, OfflineEstacionamientoDetalleCache>> {
    if (!estacionamientos.length) {
      return of({});
    }

    return forkJoin(
      estacionamientos.map(est =>
        forkJoin({
          disponibilidad: this.api
            .get<EstacionamientoDisponibilidadResponse>(
              buildEstacionamientoDisponibilidadCacheUrl(est.id)
            )
            .pipe(
              map(res => mapDisponibilidadEstacionamientoDesdeApi(res, est.nombre)),
              catchError(() => of(null))
            ),
          vehiculosActivos: this.api
            .get<VehiculosActivosResponse>(buildEstacionamientoVehiculosCacheUrl())
            .pipe(
              map(mapVehiculosActivosEstacionamientoDesdeApi),
              catchError(() => of(null))
            ),
        }).pipe(
          map(({ disponibilidad, vehiculosActivos }) => ({
            aeseNcorr: est.id,
            nombre: est.nombre,
            ubicacion: est.ubicacion,
            disponibilidad: disponibilidad ?? undefined,
            vehiculosActivos: vehiculosActivos ?? undefined,
          }))
        )
      )
    ).pipe(
      map(detalles => {
        const mapa: Record<number, OfflineEstacionamientoDetalleCache> = {};
        for (const detalle of detalles) {
          mapa[detalle.aeseNcorr] = detalle;
        }
        return mapa;
      })
    );
  }

  private async persistirCatalogo(
    catalogo: OfflineCatalogoAccesoView
  ): Promise<void> {
    await this.storage.set(OFFLINE_CATALOGO_STORAGE_KEY, catalogo);
  }
}
