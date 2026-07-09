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
  private readonly SEDE_KEY = 'auth_sede';
  private readonly RECINTO_KEY = 'auth_recinto';

  constructor(
    private api: ApiHttpService,
    private storage: AppStorageService,
    private network: NetworkService
  ) {}

  sincronizarCatalogoAcceso(
    estacionamientoSesion?: LoginEstacionamientoSesion | null,
    acreNcorr?: number | null,
    omitirEstacionamientos = false
  ): Observable<OfflineCatalogoAccesoView> {
    return this.api
      .get<OfflineCatalogoAccesoResponse>('/offline/catalogo-acceso')
      .pipe(
        map(res =>
          this.completarCatalogo(
            mapOfflineCatalogo(res),
            estacionamientoSesion,
            acreNcorr
          )
        ),
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
            estacionamientos: omitirEstacionamientos
              ? of(null as EstacionamientoCard[] | null)
              : this.api
                  .get<EstacionamientoListResponse>(
                    buildEstacionamientosCacheUrl(acreNcorr)
                  )
                  .pipe(
                    map(mapEstacionamientosDesdeApi),
                    catchError(() => of(null as EstacionamientoCard[] | null))
                  ),
          }).pipe(
            switchMap(({ resumen, detalle, estacionamientos }) =>
              this.cargarDetallesEstacionamientos(
                omitirEstacionamientos ? [] : estacionamientos ?? [],
                acreNcorr
              ).pipe(
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
    const catalogo = await this.storage.get<OfflineCatalogoAccesoView>(
      OFFLINE_CATALOGO_STORAGE_KEY
    );
    if (!catalogo) {
      return null;
    }

    const contextoActual = await this.obtenerContextoActual();
    const sedeCatalogo = catalogo.sedeCcod ?? null;
    const recintoCatalogo = catalogo.acreNcorr ?? null;

    if (
      sedeCatalogo !== contextoActual.sedeCcod ||
      recintoCatalogo !== contextoActual.acreNcorr
    ) {
      await this.storage.remove(OFFLINE_CATALOGO_STORAGE_KEY);
      return null;
    }

    return catalogo;
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
    estacionamientoSesion?: LoginEstacionamientoSesion | null,
    acreNcorr?: number | null
  ): OfflineCatalogoAccesoView {
    return {
      ...catalogo,
      acreNcorr: acreNcorr ?? null,
      estacionamiento: catalogo.estacionamiento ?? estacionamientoSesion ?? undefined,
      personas: catalogo.personas ?? [],
      patentes: catalogo.patentes ?? [],
    };
  }

  private async obtenerContextoActual(): Promise<{
    sedeCcod: number | null;
    acreNcorr: number | null;
  }> {
    const [sede, recinto] = await Promise.all([
      this.storage.get<{ id: number }>(this.SEDE_KEY),
      this.storage.get<{ id: number }>(this.RECINTO_KEY),
    ]);

    return {
      sedeCcod: sede?.id ?? null,
      acreNcorr: recinto?.id ?? null,
    };
  }

  private cargarDetallesEstacionamientos(
    estacionamientos: EstacionamientoCard[],
    acreNcorr?: number | null
  ): Observable<Record<number, OfflineEstacionamientoDetalleCache>> {
    if (!estacionamientos.length) {
      return of({});
    }

    return forkJoin(
      estacionamientos.map(est =>
        forkJoin({
          disponibilidad: this.api
            .get<EstacionamientoDisponibilidadResponse>(
              buildEstacionamientoDisponibilidadCacheUrl(acreNcorr)
            )
            .pipe(
              map(res => mapDisponibilidadEstacionamientoDesdeApi(res, est.nombre)),
              catchError(() => of(null))
            ),
          vehiculosActivos: this.api
            .get<VehiculosActivosResponse>(
              buildEstacionamientoVehiculosCacheUrl(acreNcorr)
            )
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
    const contextoActual = await this.obtenerContextoActual();
    await this.storage.set(OFFLINE_CATALOGO_STORAGE_KEY, {
      ...catalogo,
      sedeCcod: catalogo.sedeCcod ?? contextoActual.sedeCcod ?? undefined,
      acreNcorr: catalogo.acreNcorr ?? contextoActual.acreNcorr ?? null,
    });
  }
}
