import { Injectable } from '@angular/core';
import {
  Observable,
  Subject,
  catchError,
  finalize,
  forkJoin,
  from,
  map,
  of,
  shareReplay,
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
import { aplicarAjusteCatalogoOffline } from '../utils/offline-catalogo-ajuste.util';
import { OfflineValidacionUtil } from '../utils/offline-validacion.util';
import { normalizarPathCola } from '../models/offline-cola.model';
import { ApiHttpService } from './api-http.service';
import { AppStorageService } from './app-storage.service';
import { NetworkService } from './network.service';

@Injectable({ providedIn: 'root' })
export class OfflineService {
  private readonly SEDE_KEY = 'auth_sede';
  private readonly RECINTO_KEY = 'auth_recinto';
  private readonly catalogoActualizadoSubject = new Subject<void>();
  readonly catalogoActualizado$ = this.catalogoActualizadoSubject.asObservable();
  private catalogoWriteChain: Promise<void> = Promise.resolve();
  private catalogoBaseEnVuelo: Observable<OfflineCatalogoAccesoView> | null =
    null;
  /** Sube en logout/login para descartar persists de una sync anterior. */
  private catalogoGeneracion = 0;
  /** Tras login siempre se vuelve a pedir el catálogo base. */
  private forzarSyncCatalogoBase = false;

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
    return this.sincronizarCatalogoBase(estacionamientoSesion, acreNcorr).pipe(
      switchMap(catalogo =>
        this.sincronizarDatosOperativos(acreNcorr, omitirEstacionamientos).pipe(
          map(operativos => this.fusionarCatalogo(catalogo, operativos, acreNcorr))
        )
      ),
      switchMap(catalogo =>
        from(this.persistirCatalogo(catalogo, acreNcorr, false)).pipe(map(() => catalogo))
      )
    );
  }

  sincronizarCatalogoBase(
    estacionamientoSesion?: LoginEstacionamientoSesion | null,
    acreNcorr?: number | null
  ): Observable<OfflineCatalogoAccesoView> {
    if (this.catalogoBaseEnVuelo) {
      return this.catalogoBaseEnVuelo;
    }

    const generacion = this.catalogoGeneracion;

    this.catalogoBaseEnVuelo = this.api
      .get<OfflineCatalogoAccesoResponse>('/offline/catalogo-acceso', {
        timeoutMs: 300_000,
      })
      .pipe(
        map(res =>
          this.completarCatalogo(
            mapOfflineCatalogo(res),
            estacionamientoSesion,
            acreNcorr
          )
        ),
        switchMap(catalogoBase => {
          if (generacion !== this.catalogoGeneracion) {
            return of(catalogoBase);
          }
          return from(this.getCatalogoAlmacenado()).pipe(
            map(existente =>
              existente
                ? this.fusionarCatalogo(existente, catalogoBase, acreNcorr)
                : catalogoBase
            )
          );
        }),
        switchMap(catalogo => {
          if (generacion !== this.catalogoGeneracion) {
            return of(catalogo);
          }
          return from(this.persistirCatalogo(catalogo, acreNcorr, false)).pipe(
            map(() => catalogo)
          );
        }),
        map(catalogo => {
          if (generacion === this.catalogoGeneracion) {
            this.forzarSyncCatalogoBase = false;
          }
          return catalogo;
        }),
        finalize(() => {
          // No anular una sync más nueva iniciada tras logout/login.
          if (generacion === this.catalogoGeneracion) {
            this.catalogoBaseEnVuelo = null;
          }
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );

    return this.catalogoBaseEnVuelo;
  }

  sincronizarPeatonalCache(): Observable<Partial<OfflineCatalogoAccesoView>> {
    return forkJoin({
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
    }).pipe(
      map(({ resumen, detalle }) => ({
        resumenPeatonal: resumen ?? undefined,
        detallePeatonal: detalle ?? undefined,
      }))
    );
  }

  sincronizarYPersistirPeatonalCache(): Observable<OfflineCatalogoAccesoView> {
    return this.sincronizarPeatonalCache().pipe(
      switchMap(peatonal =>
        from(this.getCatalogoAlmacenado()).pipe(
          map(existente => {
            const base =
              existente ??
              ({
                sincronizadoEn: new Date().toISOString(),
                personas: [],
                patentes: [],
              } satisfies OfflineCatalogoAccesoView);
            return this.fusionarCatalogo(base, peatonal, base.acreNcorr ?? null);
          })
        )
      ),
      switchMap(catalogo =>
        from(this.persistirCatalogo(catalogo, catalogo.acreNcorr, false)).pipe(
          map(() => catalogo)
        )
      )
    );
  }

  sincronizarDetallePeatonalCache(): Observable<Partial<OfflineCatalogoAccesoView>> {
    return this.api
      .get<PeatonalDetalleResponse>(buildPeatonalDetalleCacheUrl())
      .pipe(
        map(mapDetallePeatonalDesdeApi),
        catchError(() => of(null as PeatonalDetalleView | null)),
        map(detalle => ({
          detallePeatonal: detalle ?? undefined,
        }))
      );
  }

  sincronizarYPersistirDetallePeatonalCache(): Observable<OfflineCatalogoAccesoView> {
    return this.sincronizarDetallePeatonalCache().pipe(
      switchMap(peatonal =>
        from(this.getCatalogoAlmacenado()).pipe(
          map(existente => {
            const base =
              existente ??
              ({
                sincronizadoEn: new Date().toISOString(),
                personas: [],
                patentes: [],
              } satisfies OfflineCatalogoAccesoView);
            return this.fusionarCatalogo(base, peatonal, base.acreNcorr ?? null);
          })
        )
      ),
      switchMap(catalogo =>
        from(this.persistirCatalogo(catalogo, catalogo.acreNcorr, false)).pipe(
          map(() => catalogo)
        )
      )
    );
  }

  sincronizarDatosOperativos(
    acreNcorr?: number | null,
    omitirEstacionamientos = false
  ): Observable<Partial<OfflineCatalogoAccesoView>> {
    return forkJoin({
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
      map(({ resumen, detalle, estacionamientos }) => ({
        resumenPeatonal: resumen ?? undefined,
        detallePeatonal: detalle ?? undefined,
        estacionamientos: estacionamientos ?? undefined,
      }))
    );
  }

  sincronizarSoloRecinto(
    acreNcorr?: number | null,
    estacionamientosPrecargados?: EstacionamientoCard[] | null
  ): Observable<OfflineCatalogoAccesoView> {
    const lista$ =
      estacionamientosPrecargados?.length
        ? of(estacionamientosPrecargados)
        : this.api
            .get<EstacionamientoListResponse>(
              buildEstacionamientosCacheUrl(acreNcorr)
            )
            .pipe(
              map(mapEstacionamientosDesdeApi),
              catchError(() => of([] as EstacionamientoCard[]))
            );

    return lista$.pipe(
      map(estacionamientos => ({
        estacionamientos,
      })),
      switchMap(parcial =>
        from(this.getCatalogoAlmacenado()).pipe(
          map(existente => {
            const base =
              existente ??
              ({
                sincronizadoEn: new Date().toISOString(),
                personas: [],
                patentes: [],
              } satisfies OfflineCatalogoAccesoView);
            return this.fusionarCatalogo(base, parcial, acreNcorr);
          })
        )
      ),
      switchMap(catalogo =>
        from(this.persistirCatalogo(catalogo, acreNcorr, false)).pipe(map(() => catalogo))
      )
    );
  }

  sincronizarDetallesRecinto(
    acreNcorr?: number | null,
    estacionamientos?: EstacionamientoCard[] | null
  ): Observable<OfflineCatalogoAccesoView> {
    return from(this.getCatalogoAlmacenado()).pipe(
      switchMap(catalogo => {
        const lista =
          estacionamientos?.length
            ? estacionamientos
            : catalogo?.estacionamientos ?? [];

        return this.cargarDetallesEstacionamientos(lista, acreNcorr).pipe(
          map(estacionamientosDetalle => ({
            estacionamientos: lista,
            estacionamientosDetalle,
          }))
        );
      }),
      switchMap(parcial =>
        from(this.getCatalogoAlmacenado()).pipe(
          map(existente => {
            const base =
              existente ??
              ({
                sincronizadoEn: new Date().toISOString(),
                personas: [],
                patentes: [],
              } satisfies OfflineCatalogoAccesoView);
            return this.fusionarCatalogo(base, parcial, acreNcorr);
          })
        )
      ),
      switchMap(catalogo =>
        from(this.persistirCatalogo(catalogo, acreNcorr, false)).pipe(map(() => catalogo))
      )
    );
  }

  async persistirResumenPeatonalEnCache(
    resumen: PeatonalResumenView
  ): Promise<void> {
    const existente = await this.getCatalogoAlmacenado();
    const base =
      existente ??
      ({
        sincronizadoEn: new Date().toISOString(),
        personas: [],
        patentes: [],
      } satisfies OfflineCatalogoAccesoView);

    await this.persistirCatalogo(
      this.fusionarCatalogo(
        base,
        { resumenPeatonal: resumen },
        base.acreNcorr ?? null
      ),
      base.acreNcorr ?? null,
      false
    );
  }

  async persistirEstacionamientosEnCache(
    estacionamientos: EstacionamientoCard[],
    acreNcorr?: number | null
  ): Promise<void> {
    const existente = await this.getCatalogoAlmacenado();
    const base =
      existente ??
      ({
        sincronizadoEn: new Date().toISOString(),
        personas: [],
        patentes: [],
      } satisfies OfflineCatalogoAccesoView);

    await this.persistirCatalogo(
      this.fusionarCatalogo(base, { estacionamientos }, acreNcorr ?? null),
      acreNcorr ?? null,
      false
    );
  }

  sincronizarYPersistirDatosOperativos(
    acreNcorr?: number | null
  ): Observable<OfflineCatalogoAccesoView> {
    return this.sincronizarDatosOperativos(acreNcorr).pipe(
      switchMap(operativos =>
        from(this.getCatalogoAlmacenado()).pipe(
          map(existente => {
            const base =
              existente ??
              ({
                sincronizadoEn: new Date().toISOString(),
                personas: [],
                patentes: [],
              } satisfies OfflineCatalogoAccesoView);
            return this.fusionarCatalogo(base, operativos, acreNcorr);
          })
        )
      ),
      switchMap(catalogo =>
        from(this.persistirCatalogo(catalogo, acreNcorr, false)).pipe(map(() => catalogo))
      )
    );
  }

  notificarActualizacionCatalogo(): void {
    this.notificarCatalogoActualizado();
  }

  async tieneCatalogoBase(): Promise<boolean> {
    const catalogo = await this.getCatalogo();
    return OfflineValidacionUtil.tieneCatalogoValidacion(catalogo);
  }

  async necesitaCatalogoBase(): Promise<boolean> {
    if (this.forzarSyncCatalogoBase) {
      return true;
    }
    return !(await this.tieneCatalogoBase());
  }

  /** Llamar en login/logout: limpia cache e invalida syncs en curso. */
  async invalidarCatalogoPorNuevaSesion(): Promise<void> {
    this.catalogoGeneracion += 1;
    this.catalogoBaseEnVuelo = null;
    this.forzarSyncCatalogoBase = true;
    await this.enqueueCatalogoWrite(async () => {
      await this.storage.remove(OFFLINE_CATALOGO_STORAGE_KEY);
    });
  }

  async necesitaSyncRecinto(acreNcorr?: number | null): Promise<boolean> {
    const catalogo = await this.getCatalogo();
    if (!catalogo) {
      return true;
    }

    const recintoActual = acreNcorr ?? null;
    if ((catalogo.acreNcorr ?? null) !== recintoActual) {
      return true;
    }

    return !catalogo.estacionamientos?.length;
  }

  async necesitaDetallesRecinto(acreNcorr?: number | null): Promise<boolean> {
    const catalogo = await this.getCatalogo();
    if (!catalogo?.estacionamientos?.length) {
      return false;
    }

    if ((catalogo.acreNcorr ?? null) !== (acreNcorr ?? null)) {
      return false;
    }

    const detalles = catalogo.estacionamientosDetalle ?? {};
    return !catalogo.estacionamientos.every(
      est => detalles[est.id]?.disponibilidad != null
    );
  }

  async getCatalogo(): Promise<OfflineCatalogoAccesoView | null> {
    const catalogo = await this.getCatalogoAlmacenado();
    if (!catalogo) {
      return null;
    }

    const contextoActual = await this.obtenerContextoActual();
    const sedeCatalogo =
      catalogo.sedeCcod != null ? Number(catalogo.sedeCcod) : null;
    const sedeActual =
      contextoActual.sedeCcod != null ? Number(contextoActual.sedeCcod) : null;

    // Solo invalidar si ambas sedes están definidas y no coinciden.
    if (
      sedeCatalogo != null &&
      sedeActual != null &&
      sedeCatalogo !== sedeActual
    ) {
      await this.storage.remove(OFFLINE_CATALOGO_STORAGE_KEY);
      return null;
    }

    return catalogo;
  }

  private async getCatalogoAlmacenado(): Promise<OfflineCatalogoAccesoView | null> {
    return (
      (await this.storage.get<OfflineCatalogoAccesoView>(
        OFFLINE_CATALOGO_STORAGE_KEY
      )) ?? null
    );
  }

  private fusionarCatalogo(
    base: OfflineCatalogoAccesoView,
    actualizacion: Partial<OfflineCatalogoAccesoView>,
    acreNcorr?: number | null
  ): OfflineCatalogoAccesoView {
    return {
      ...base,
      ...actualizacion,
      acreNcorr: acreNcorr ?? base.acreNcorr ?? null,
      // No dejar que un [] de un persist parcial (resumen/estacionamientos) borre el catálogo base.
      personas: this.preferirListaConDatos(actualizacion.personas, base.personas),
      patentes: this.preferirListaConDatos(actualizacion.patentes, base.patentes),
      estacionamiento: actualizacion.estacionamiento ?? base.estacionamiento,
      sincronizadoEn: new Date().toISOString(),
    };
  }

  private preferirListaConDatos<T>(
    nuevo?: T[] | null,
    base?: T[] | null
  ): T[] {
    if (nuevo != null && nuevo.length > 0) {
      return nuevo;
    }
    if (base != null && base.length > 0) {
      return base;
    }
    return nuevo ?? base ?? [];
  }

  private enqueueCatalogoWrite<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.catalogoWriteChain.then(fn, fn);
    this.catalogoWriteChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
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
    if (!catalogo) {
      return [];
    }

    const contexto = await this.obtenerContextoActual();
    if ((catalogo.acreNcorr ?? null) !== contexto.acreNcorr) {
      return [];
    }

    return catalogo.estacionamientos ?? [];
  }

  async getEstacionamientoDetalleOffline(
    aeseNcorr: number
  ): Promise<OfflineEstacionamientoDetalleCache | null> {
    const catalogo = await this.getCatalogo();
    if (!catalogo) {
      return null;
    }

    const contexto = await this.obtenerContextoActual();
    if ((catalogo.acreNcorr ?? null) !== contexto.acreNcorr) {
      return null;
    }

    return catalogo.estacionamientosDetalle?.[aeseNcorr] ?? null;
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
    await this.invalidarCatalogoPorNuevaSesion();
  }

  async aplicarAjusteLocalPorOperacion(
    path: string,
    body: unknown
  ): Promise<void> {
    const catalogo = await this.getCatalogo();
    if (!catalogo) {
      return;
    }

    const actualizado = aplicarAjusteCatalogoOffline(
      catalogo,
      normalizarPathCola(path),
      body
    );
    await this.persistirCatalogo(actualizado);
  }

  private notificarCatalogoActualizado(): void {
    this.catalogoActualizadoSubject.next();
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
    _acreNcorr?: number | null
  ): Observable<Record<number, OfflineEstacionamientoDetalleCache>> {
    if (!estacionamientos.length) {
      return of({});
    }

    const porEstacionamiento = estacionamientos.map(est =>
      forkJoin({
        disponibilidad: this.api
          .get<EstacionamientoDisponibilidadResponse>(
            buildEstacionamientoDisponibilidadCacheUrl({
              acreNcorr: est.acreNcorr,
              aeseNcorr: est.aeseNcorr,
            })
          )
          .pipe(catchError(() => of(null))),
        vehiculosActivos: this.api
          .get<VehiculosActivosResponse>(
            buildEstacionamientoVehiculosCacheUrl({
              acreNcorr: est.acreNcorr,
              aeseNcorr: est.aeseNcorr,
            })
          )
          .pipe(
            map(mapVehiculosActivosEstacionamientoDesdeApi),
            catchError(() => of(null))
          ),
      }).pipe(
        map(({ disponibilidad, vehiculosActivos }) => ({
          id: est.id,
          detalle: {
            aeseNcorr: est.aeseNcorr ?? est.id,
            nombre: est.nombre,
            ubicacion: est.ubicacion,
            disponibilidad: disponibilidad
              ? mapDisponibilidadEstacionamientoDesdeApi(
                  disponibilidad,
                  est.nombre
                )
              : undefined,
            vehiculosActivos: vehiculosActivos ?? undefined,
          } satisfies OfflineEstacionamientoDetalleCache,
        }))
      )
    );

    return forkJoin(porEstacionamiento).pipe(
      map(items => {
        const mapa: Record<number, OfflineEstacionamientoDetalleCache> = {};
        for (const item of items) {
          mapa[item.id] = item.detalle;
        }
        return mapa;
      })
    );
  }

  private async persistirCatalogo(
    catalogo: OfflineCatalogoAccesoView,
    acreNcorr?: number | null,
    notificar = true
  ): Promise<void> {
    const generacionAlSolicitar = this.catalogoGeneracion;
    await this.enqueueCatalogoWrite(async () => {
      // Logout/login invalidó esta sync: no reescribir el storage.
      if (generacionAlSolicitar !== this.catalogoGeneracion) {
        return;
      }

      const contextoActual = await this.obtenerContextoActual();
      // Re-leer dentro de la cola: un persist paralelo no puede pisar personas/patentes.
      const existente = await this.getCatalogoAlmacenado();
      const aGuardar = existente
        ? this.fusionarCatalogo(
            existente,
            catalogo,
            acreNcorr ?? catalogo.acreNcorr
          )
        : catalogo;

      await this.storage.set(OFFLINE_CATALOGO_STORAGE_KEY, {
        ...aGuardar,
        sedeCcod: aGuardar.sedeCcod ?? contextoActual.sedeCcod ?? undefined,
        acreNcorr:
          acreNcorr ??
          aGuardar.acreNcorr ??
          contextoActual.acreNcorr ??
          null,
      });

      if (notificar) {
        this.notificarCatalogoActualizado();
      }
    });
  }
}
