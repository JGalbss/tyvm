/**
 * Ambient module declarations for common Java standard-library classes.
 *
 * These declarations let TypeScript tooling understand `java:*` imports
 * so that editors provide autocompletion and type-checking without errors.
 * At compile time the tyvm compiler resolves these imports to real JVM
 * classes — these declarations exist purely for IDE support.
 */

declare module "java:java.net.http.HttpClient" {
  export class HttpClient {
    cookieHandler(): any | null;
    connectTimeout(): any | null;
    followRedirects(): HttpClientRedirect;
    proxy(): any | null;
    sslContext(): any;
    sslParameters(): any;
    authenticator(): any | null;
    version(): HttpClientVersion;
    executor(): any | null;
    send<T>(arg0: any, arg1: HttpResponse$BodyHandler<T>): HttpResponse<T>;
    sendAsync<T>(arg0: any, arg1: HttpResponse$BodyHandler<T>): Promise<HttpResponse<T>>;
    sendAsync<T>(arg0: any, arg1: HttpResponse$BodyHandler<T>, arg2: HttpResponse$PushPromiseHandler<T>): Promise<HttpResponse<T>>;
    newWebSocketBuilder(): WebSocketBuilder;
    shutdown(): void;
    awaitTermination(arg0: any): boolean;
    isTerminated(): boolean;
    shutdownNow(): void;
    close(): void;
    static newHttpClient(): any;
    static newBuilder(): HttpClientBuilder;
  }
}

declare module "java:java.time.LocalDate" {
  export class LocalDate {
    isSupported(arg0: any): boolean;
    isSupported(arg0: any): boolean;
    range(arg0: any): any;
    get(arg0: any): number;
    getLong(arg0: any): number;
    getChronology(): any;
    getEra(): any;
    getYear(): number;
    getMonthValue(): number;
    getMonth(): any;
    getDayOfMonth(): number;
    getDayOfYear(): number;
    getDayOfWeek(): any;
    isLeapYear(): boolean;
    lengthOfMonth(): number;
    lengthOfYear(): number;
    with(arg0: any): any;
    with(arg0: any, arg1: number): any;
    withYear(arg0: number): any;
    withMonth(arg0: number): any;
    withDayOfMonth(arg0: number): any;
    withDayOfYear(arg0: number): any;
    plus(arg0: any): any;
    plus(arg0: number, arg1: any): any;
    plusYears(arg0: number): any;
    plusMonths(arg0: number): any;
    plusWeeks(arg0: number): any;
    plusDays(arg0: number): any;
    minus(arg0: any): any;
    minus(arg0: number, arg1: any): any;
    minusYears(arg0: number): any;
    minusMonths(arg0: number): any;
    minusWeeks(arg0: number): any;
    minusDays(arg0: number): any;
    query<R>(arg0: TemporalQuery<R>): R;
    adjustInto(arg0: any): any;
    until(arg0: any, arg1: any): number;
    until(arg0: any): any;
    datesUntil(arg0: any): Stream<any>;
    datesUntil(arg0: any, arg1: any): Stream<any>;
    format(arg0: any): string;
    atTime(arg0: any): any;
    atTime(arg0: number, arg1: number): any;
    atTime(arg0: number, arg1: number, arg2: number): any;
    atTime(arg0: number, arg1: number, arg2: number, arg3: number): any;
    atTime(arg0: any): any;
    atStartOfDay(): any;
    atStartOfDay(arg0: any): any;
    toEpochDay(): number;
    toEpochSecond(arg0: any, arg1: any): number;
    compareTo(arg0: any): number;
    isAfter(arg0: any): boolean;
    isBefore(arg0: any): boolean;
    isEqual(arg0: any): boolean;
    equals(arg0: any): boolean;
    hashCode(): number;
    toString(): string;
    minus(arg0: number, arg1: any): any;
    minus(arg0: any): any;
    plus(arg0: number, arg1: any): any;
    plus(arg0: any): any;
    with(arg0: any, arg1: number): any;
    with(arg0: any): any;
    atTime(arg0: any): any;
    until(arg0: any): any;
    minus(arg0: number, arg1: any): any;
    minus(arg0: any): any;
    plus(arg0: number, arg1: any): any;
    plus(arg0: any): any;
    with(arg0: any, arg1: number): any;
    with(arg0: any): any;
    getEra(): any;
    getChronology(): any;
    compareTo(arg0: any): number;
    static now(): any;
    static now(arg0: any): any;
    static now(arg0: any): any;
    static of(arg0: number, arg1: any, arg2: number): any;
    static of(arg0: number, arg1: number, arg2: number): any;
    static ofYearDay(arg0: number, arg1: number): any;
    static ofInstant(arg0: any, arg1: any): any;
    static ofEpochDay(arg0: number): any;
    static from(arg0: any): any;
    static parse(arg0: any): any;
    static parse(arg0: any, arg1: any): any;
    static MIN: any;
    static MAX: any;
    static EPOCH: any;
  }
}

declare module "java:java.time.LocalDateTime" {
  export class LocalDateTime<java.time.LocalDate> {
    isSupported(arg0: any): boolean;
    isSupported(arg0: any): boolean;
    range(arg0: any): any;
    get(arg0: any): number;
    getLong(arg0: any): number;
    toLocalDate(): java.time.LocalDate;
    getYear(): number;
    getMonthValue(): number;
    getMonth(): any;
    getDayOfMonth(): number;
    getDayOfYear(): number;
    getDayOfWeek(): any;
    toLocalTime(): any;
    getHour(): number;
    getMinute(): number;
    getSecond(): number;
    getNano(): number;
    with(arg0: any): any;
    with(arg0: any, arg1: number): any;
    withYear(arg0: number): any;
    withMonth(arg0: number): any;
    withDayOfMonth(arg0: number): any;
    withDayOfYear(arg0: number): any;
    withHour(arg0: number): any;
    withMinute(arg0: number): any;
    withSecond(arg0: number): any;
    withNano(arg0: number): any;
    truncatedTo(arg0: any): any;
    plus(arg0: any): any;
    plus(arg0: number, arg1: any): any;
    plusYears(arg0: number): any;
    plusMonths(arg0: number): any;
    plusWeeks(arg0: number): any;
    plusDays(arg0: number): any;
    plusHours(arg0: number): any;
    plusMinutes(arg0: number): any;
    plusSeconds(arg0: number): any;
    plusNanos(arg0: number): any;
    minus(arg0: any): any;
    minus(arg0: number, arg1: any): any;
    minusYears(arg0: number): any;
    minusMonths(arg0: number): any;
    minusWeeks(arg0: number): any;
    minusDays(arg0: number): any;
    minusHours(arg0: number): any;
    minusMinutes(arg0: number): any;
    minusSeconds(arg0: number): any;
    minusNanos(arg0: number): any;
    query<R>(arg0: TemporalQuery<R>): R;
    adjustInto(arg0: any): any;
    until(arg0: any, arg1: any): number;
    format(arg0: any): string;
    atOffset(arg0: any): any;
    atZone(arg0: any): any;
    compareTo(arg0: ChronoLocalDateTime<any>): number;
    isAfter(arg0: ChronoLocalDateTime<any>): boolean;
    isBefore(arg0: ChronoLocalDateTime<any>): boolean;
    isEqual(arg0: ChronoLocalDateTime<any>): boolean;
    equals(arg0: any): boolean;
    hashCode(): number;
    toString(): string;
    minus(arg0: number, arg1: any): any;
    minus(arg0: any): any;
    plus(arg0: number, arg1: any): any;
    plus(arg0: any): any;
    with(arg0: any, arg1: number): any;
    with(arg0: any): any;
    atZone(arg0: any): any;
    minus(arg0: number, arg1: any): any;
    minus(arg0: any): any;
    plus(arg0: number, arg1: any): any;
    plus(arg0: any): any;
    with(arg0: any, arg1: number): any;
    with(arg0: any): any;
    toLocalDate(): any;
    compareTo(arg0: any): number;
    static now(): any;
    static now(arg0: any): any;
    static now(arg0: any): any;
    static of(arg0: number, arg1: any, arg2: number, arg3: number, arg4: number): any;
    static of(arg0: number, arg1: any, arg2: number, arg3: number, arg4: number, arg5: number): any;
    static of(arg0: number, arg1: any, arg2: number, arg3: number, arg4: number, arg5: number, arg6: number): any;
    static of(arg0: number, arg1: number, arg2: number, arg3: number, arg4: number): any;
    static of(arg0: number, arg1: number, arg2: number, arg3: number, arg4: number, arg5: number): any;
    static of(arg0: number, arg1: number, arg2: number, arg3: number, arg4: number, arg5: number, arg6: number): any;
    static of(arg0: java.time.LocalDate, arg1: any): any;
    static ofInstant(arg0: any, arg1: any): any;
    static ofEpochSecond(arg0: number, arg1: number, arg2: any): any;
    static from(arg0: any): any;
    static parse(arg0: any): any;
    static parse(arg0: any, arg1: any): any;
    static MIN: any;
    static MAX: any;
  }
}

declare module "java:java.time.Instant" {
  export class Instant<java.time.Instant> {
    isSupported(arg0: any): boolean;
    isSupported(arg0: any): boolean;
    range(arg0: any): any;
    get(arg0: any): number;
    getLong(arg0: any): number;
    getEpochSecond(): number;
    getNano(): number;
    with(arg0: any): java.time.Instant;
    with(arg0: any, arg1: number): java.time.Instant;
    truncatedTo(arg0: any): java.time.Instant;
    plus(arg0: any): java.time.Instant;
    plus(arg0: number, arg1: any): java.time.Instant;
    plusSeconds(arg0: number): java.time.Instant;
    plusMillis(arg0: number): java.time.Instant;
    plusNanos(arg0: number): java.time.Instant;
    minus(arg0: any): java.time.Instant;
    minus(arg0: number, arg1: any): java.time.Instant;
    minusSeconds(arg0: number): java.time.Instant;
    minusMillis(arg0: number): java.time.Instant;
    minusNanos(arg0: number): java.time.Instant;
    query<R>(arg0: TemporalQuery<R>): R;
    adjustInto(arg0: any): any;
    until(arg0: any, arg1: any): number;
    until(arg0: java.time.Instant): any;
    atOffset(arg0: any): any;
    atZone(arg0: any): any;
    toEpochMilli(): number;
    compareTo(arg0: java.time.Instant): number;
    isAfter(arg0: java.time.Instant): boolean;
    isBefore(arg0: java.time.Instant): boolean;
    equals(arg0: any): boolean;
    hashCode(): number;
    toString(): string;
    minus(arg0: number, arg1: any): any;
    minus(arg0: any): any;
    plus(arg0: number, arg1: any): any;
    plus(arg0: any): any;
    with(arg0: any, arg1: number): any;
    with(arg0: any): any;
    compareTo(arg0: any): number;
    static now(): java.time.Instant;
    static now(arg0: any): java.time.Instant;
    static ofEpochSecond(arg0: number): java.time.Instant;
    static ofEpochSecond(arg0: number, arg1: number): java.time.Instant;
    static ofEpochMilli(arg0: number): java.time.Instant;
    static from(arg0: any): java.time.Instant;
    static parse(arg0: any): java.time.Instant;
    static EPOCH: java.time.Instant;
    static MIN: java.time.Instant;
    static MAX: java.time.Instant;
  }
}

declare module "java:java.util.concurrent.AbstractExecutorService" {
  export class AbstractExecutorService {
    constructor();
    submit(arg0: any): Promise<any>;
    submit<T>(arg0: any, arg1: T): Promise<T>;
    submit<T>(arg0: Callable<T>): Promise<T>;
    invokeAny<T>(arg0: Callable<T>[]): T;
    invokeAny<T>(arg0: Callable<T>[], arg1: number, arg2: any): T;
    invokeAll<T>(arg0: Callable<T>[]): Promise<T>[];
    invokeAll<T>(arg0: Callable<T>[], arg1: number, arg2: any): Promise<T>[];
  }
}

declare module "java:java.util.concurrent.ArrayBlockingQueue" {
  export class ArrayBlockingQueue<E> {
    constructor(arg0: number);
    constructor(arg0: number, arg1: boolean);
    constructor(arg0: number, arg1: boolean, arg2: E[]);
    add(arg0: E): boolean;
    offer(arg0: E): boolean;
    put(arg0: E): void;
    offer(arg0: E, arg1: number, arg2: any): boolean;
    poll(): E;
    take(): E;
    poll(arg0: number, arg1: any): E;
    peek(): E;
    size(): number;
    remainingCapacity(): number;
    remove(arg0: any): boolean;
    contains(arg0: any): boolean;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    toString(): string;
    clear(): void;
    drainTo(arg0: any[]): number;
    drainTo(arg0: any[], arg1: number): number;
    iterator(): Iterable<E>;
    spliterator(): Spliterator<E>;
    forEach(arg0: (value: any) => void): void;
    removeIf(arg0: (value: any) => boolean): boolean;
    removeAll(arg0: any[]): boolean;
    retainAll(arg0: any[]): boolean;
  }
}

declare module "java:java.util.concurrent.BlockingDeque" {
  export class BlockingDeque<E> {
    addFirst(arg0: E): void;
    addLast(arg0: E): void;
    offerFirst(arg0: E): boolean;
    offerLast(arg0: E): boolean;
    putFirst(arg0: E): void;
    putLast(arg0: E): void;
    offerFirst(arg0: E, arg1: number, arg2: any): boolean;
    offerLast(arg0: E, arg1: number, arg2: any): boolean;
    takeFirst(): E;
    takeLast(): E;
    pollFirst(arg0: number, arg1: any): E;
    pollLast(arg0: number, arg1: any): E;
    removeFirstOccurrence(arg0: any): boolean;
    removeLastOccurrence(arg0: any): boolean;
    add(arg0: E): boolean;
    offer(arg0: E): boolean;
    put(arg0: E): void;
    offer(arg0: E, arg1: number, arg2: any): boolean;
    remove(): E;
    poll(): E;
    take(): E;
    poll(arg0: number, arg1: any): E;
    element(): E;
    peek(): E;
    remove(arg0: any): boolean;
    contains(arg0: any): boolean;
    size(): number;
    iterator(): Iterable<E>;
    push(arg0: E): void;
  }
}

declare module "java:java.util.concurrent.BlockingQueue" {
  export class BlockingQueue<E> {
    add(arg0: E): boolean;
    offer(arg0: E): boolean;
    put(arg0: E): void;
    offer(arg0: E, arg1: number, arg2: any): boolean;
    take(): E;
    poll(arg0: number, arg1: any): E;
    remainingCapacity(): number;
    remove(arg0: any): boolean;
    contains(arg0: any): boolean;
    drainTo(arg0: any[]): number;
    drainTo(arg0: any[], arg1: number): number;
  }
}

declare module "java:java.util.concurrent.BrokenBarrierException" {
  export class BrokenBarrierException {
    constructor();
    constructor(arg0: string);
  }
}

declare module "java:java.util.concurrent.Callable" {
  export class Callable<V> {
    call(): V;
  }
}

declare module "java:java.util.concurrent.CancellationException" {
  export class CancellationException {
    constructor();
    constructor(arg0: string);
  }
}

declare module "java:java.util.concurrent.CompletableFuture" {
  export class CompletableFuture<T> {
    constructor();
    isDone(): boolean;
    get(): T;
    get(arg0: number, arg1: any): T;
    join(): T;
    getNow(arg0: T): T;
    resultNow(): T;
    exceptionNow(): any;
    complete(arg0: T): boolean;
    completeExceptionally(arg0: any): boolean;
    thenApply<U>(arg0: (arg: any) => U): Promise<U>;
    thenApplyAsync<U>(arg0: (arg: any) => U): Promise<U>;
    thenApplyAsync<U>(arg0: (arg: any) => U, arg1: any): Promise<U>;
    thenAccept(arg0: (value: any) => void): Promise<void>;
    thenAcceptAsync(arg0: (value: any) => void): Promise<void>;
    thenAcceptAsync(arg0: (value: any) => void, arg1: any): Promise<void>;
    thenRun(arg0: any): Promise<void>;
    thenRunAsync(arg0: any): Promise<void>;
    thenRunAsync(arg0: any, arg1: any): Promise<void>;
    thenCombine<U, V>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => V): Promise<V>;
    thenCombineAsync<U, V>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => V): Promise<V>;
    thenCombineAsync<U, V>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => V, arg2: any): Promise<V>;
    thenAcceptBoth<U>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => void): Promise<void>;
    thenAcceptBothAsync<U>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => void): Promise<void>;
    thenAcceptBothAsync<U>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => void, arg2: any): Promise<void>;
    runAfterBoth(arg0: CompletionStage<any>, arg1: any): Promise<void>;
    runAfterBothAsync(arg0: CompletionStage<any>, arg1: any): Promise<void>;
    runAfterBothAsync(arg0: CompletionStage<any>, arg1: any, arg2: any): Promise<void>;
    applyToEither<U>(arg0: CompletionStage<T>, arg1: (arg: any) => U): Promise<U>;
    applyToEitherAsync<U>(arg0: CompletionStage<T>, arg1: (arg: any) => U): Promise<U>;
    applyToEitherAsync<U>(arg0: CompletionStage<T>, arg1: (arg: any) => U, arg2: any): Promise<U>;
    acceptEither(arg0: CompletionStage<T>, arg1: (value: any) => void): Promise<void>;
    acceptEitherAsync(arg0: CompletionStage<T>, arg1: (value: any) => void): Promise<void>;
    acceptEitherAsync(arg0: CompletionStage<T>, arg1: (value: any) => void, arg2: any): Promise<void>;
    runAfterEither(arg0: CompletionStage<any>, arg1: any): Promise<void>;
    runAfterEitherAsync(arg0: CompletionStage<any>, arg1: any): Promise<void>;
    runAfterEitherAsync(arg0: CompletionStage<any>, arg1: any, arg2: any): Promise<void>;
    thenCompose<U>(arg0: (arg: any) => CompletionStage<U>): Promise<U>;
    thenComposeAsync<U>(arg0: (arg: any) => CompletionStage<U>): Promise<U>;
    thenComposeAsync<U>(arg0: (arg: any) => CompletionStage<U>, arg1: any): Promise<U>;
    whenComplete(arg0: (a: any, b: any) => void): Promise<T>;
    whenCompleteAsync(arg0: (a: any, b: any) => void): Promise<T>;
    whenCompleteAsync(arg0: (a: any, b: any) => void, arg1: any): Promise<T>;
    handle<U>(arg0: (a: any, b: any) => U): Promise<U>;
    handleAsync<U>(arg0: (a: any, b: any) => U): Promise<U>;
    handleAsync<U>(arg0: (a: any, b: any) => U, arg1: any): Promise<U>;
    toCompletableFuture(): Promise<T>;
    exceptionally(arg0: (arg: any) => T): Promise<T>;
    exceptionallyAsync(arg0: (arg: any) => T): Promise<T>;
    exceptionallyAsync(arg0: (arg: any) => T, arg1: any): Promise<T>;
    exceptionallyCompose(arg0: (arg: any) => CompletionStage<T>): Promise<T>;
    exceptionallyComposeAsync(arg0: (arg: any) => CompletionStage<T>): Promise<T>;
    exceptionallyComposeAsync(arg0: (arg: any) => CompletionStage<T>, arg1: any): Promise<T>;
    cancel(arg0: boolean): boolean;
    isCancelled(): boolean;
    isCompletedExceptionally(): boolean;
    state(): FutureState;
    obtrudeValue(arg0: T): void;
    obtrudeException(arg0: any): void;
    getNumberOfDependents(): number;
    toString(): string;
    newIncompleteFuture<U>(): Promise<U>;
    defaultExecutor(): any;
    copy(): Promise<T>;
    minimalCompletionStage(): CompletionStage<T>;
    completeAsync(arg0: () => T, arg1: any): Promise<T>;
    completeAsync(arg0: () => T): Promise<T>;
    orTimeout(arg0: number, arg1: any): Promise<T>;
    completeOnTimeout(arg0: T, arg1: number, arg2: any): Promise<T>;
    exceptionallyComposeAsync(arg0: any, arg1: any): any;
    exceptionallyComposeAsync(arg0: any): any;
    exceptionallyCompose(arg0: any): any;
    exceptionallyAsync(arg0: any, arg1: any): any;
    exceptionallyAsync(arg0: any): any;
    exceptionally(arg0: any): any;
    whenCompleteAsync(arg0: any, arg1: any): any;
    whenCompleteAsync(arg0: any): any;
    whenComplete(arg0: any): any;
    handleAsync(arg0: any, arg1: any): any;
    handleAsync(arg0: any): any;
    handle(arg0: any): any;
    thenComposeAsync(arg0: any, arg1: any): any;
    thenComposeAsync(arg0: any): any;
    thenCompose(arg0: any): any;
    runAfterEitherAsync(arg0: any, arg1: any, arg2: any): any;
    runAfterEitherAsync(arg0: any, arg1: any): any;
    runAfterEither(arg0: any, arg1: any): any;
    acceptEitherAsync(arg0: any, arg1: any, arg2: any): any;
    acceptEitherAsync(arg0: any, arg1: any): any;
    acceptEither(arg0: any, arg1: any): any;
    applyToEitherAsync(arg0: any, arg1: any, arg2: any): any;
    applyToEitherAsync(arg0: any, arg1: any): any;
    applyToEither(arg0: any, arg1: any): any;
    runAfterBothAsync(arg0: any, arg1: any, arg2: any): any;
    runAfterBothAsync(arg0: any, arg1: any): any;
    runAfterBoth(arg0: any, arg1: any): any;
    thenAcceptBothAsync(arg0: any, arg1: any, arg2: any): any;
    thenAcceptBothAsync(arg0: any, arg1: any): any;
    thenAcceptBoth(arg0: any, arg1: any): any;
    thenCombineAsync(arg0: any, arg1: any, arg2: any): any;
    thenCombineAsync(arg0: any, arg1: any): any;
    thenCombine(arg0: any, arg1: any): any;
    thenRunAsync(arg0: any, arg1: any): any;
    thenRunAsync(arg0: any): any;
    thenRun(arg0: any): any;
    thenAcceptAsync(arg0: any, arg1: any): any;
    thenAcceptAsync(arg0: any): any;
    thenAccept(arg0: any): any;
    thenApplyAsync(arg0: any, arg1: any): any;
    thenApplyAsync(arg0: any): any;
    thenApply(arg0: any): any;
    static supplyAsync<U>(arg0: () => U): Promise<U>;
    static supplyAsync<U>(arg0: () => U, arg1: any): Promise<U>;
    static runAsync(arg0: any): Promise<void>;
    static runAsync(arg0: any, arg1: any): Promise<void>;
    static completedFuture<U>(arg0: U): Promise<U>;
    static allOf(arg0: Promise<any>[]): Promise<void>;
    static anyOf(arg0: Promise<any>[]): Promise<any>;
    static delayedExecutor(arg0: number, arg1: any, arg2: any): any;
    static delayedExecutor(arg0: number, arg1: any): any;
    static completedStage<U>(arg0: U): CompletionStage<U>;
    static failedFuture<U>(arg0: any): Promise<U>;
    static failedStage<U>(arg0: any): CompletionStage<U>;
  }
}

declare module "java:java.util.concurrent.CompletionException" {
  export class CompletionException {
    constructor(arg0: string, arg1: any);
    constructor(arg0: any);
  }
}

declare module "java:java.util.concurrent.CompletionService" {
  export class CompletionService<V> {
    submit(arg0: Callable<V>): Promise<V>;
    submit(arg0: any, arg1: V): Promise<V>;
    take(): Promise<V>;
    poll(): Promise<V>;
    poll(arg0: number, arg1: any): Promise<V>;
  }
}

declare module "java:java.util.concurrent.CompletionStage" {
  export class CompletionStage<T> {
    thenApply<U>(arg0: (arg: any) => U): CompletionStage<U>;
    thenApplyAsync<U>(arg0: (arg: any) => U): CompletionStage<U>;
    thenApplyAsync<U>(arg0: (arg: any) => U, arg1: any): CompletionStage<U>;
    thenAccept(arg0: (value: any) => void): CompletionStage<void>;
    thenAcceptAsync(arg0: (value: any) => void): CompletionStage<void>;
    thenAcceptAsync(arg0: (value: any) => void, arg1: any): CompletionStage<void>;
    thenRun(arg0: any): CompletionStage<void>;
    thenRunAsync(arg0: any): CompletionStage<void>;
    thenRunAsync(arg0: any, arg1: any): CompletionStage<void>;
    thenCombine<U, V>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => V): CompletionStage<V>;
    thenCombineAsync<U, V>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => V): CompletionStage<V>;
    thenCombineAsync<U, V>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => V, arg2: any): CompletionStage<V>;
    thenAcceptBoth<U>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => void): CompletionStage<void>;
    thenAcceptBothAsync<U>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => void): CompletionStage<void>;
    thenAcceptBothAsync<U>(arg0: CompletionStage<U>, arg1: (a: any, b: any) => void, arg2: any): CompletionStage<void>;
    runAfterBoth(arg0: CompletionStage<any>, arg1: any): CompletionStage<void>;
    runAfterBothAsync(arg0: CompletionStage<any>, arg1: any): CompletionStage<void>;
    runAfterBothAsync(arg0: CompletionStage<any>, arg1: any, arg2: any): CompletionStage<void>;
    applyToEither<U>(arg0: CompletionStage<T>, arg1: (arg: any) => U): CompletionStage<U>;
    applyToEitherAsync<U>(arg0: CompletionStage<T>, arg1: (arg: any) => U): CompletionStage<U>;
    applyToEitherAsync<U>(arg0: CompletionStage<T>, arg1: (arg: any) => U, arg2: any): CompletionStage<U>;
    acceptEither(arg0: CompletionStage<T>, arg1: (value: any) => void): CompletionStage<void>;
    acceptEitherAsync(arg0: CompletionStage<T>, arg1: (value: any) => void): CompletionStage<void>;
    acceptEitherAsync(arg0: CompletionStage<T>, arg1: (value: any) => void, arg2: any): CompletionStage<void>;
    runAfterEither(arg0: CompletionStage<any>, arg1: any): CompletionStage<void>;
    runAfterEitherAsync(arg0: CompletionStage<any>, arg1: any): CompletionStage<void>;
    runAfterEitherAsync(arg0: CompletionStage<any>, arg1: any, arg2: any): CompletionStage<void>;
    thenCompose<U>(arg0: (arg: any) => CompletionStage<U>): CompletionStage<U>;
    thenComposeAsync<U>(arg0: (arg: any) => CompletionStage<U>): CompletionStage<U>;
    thenComposeAsync<U>(arg0: (arg: any) => CompletionStage<U>, arg1: any): CompletionStage<U>;
    handle<U>(arg0: (a: any, b: any) => U): CompletionStage<U>;
    handleAsync<U>(arg0: (a: any, b: any) => U): CompletionStage<U>;
    handleAsync<U>(arg0: (a: any, b: any) => U, arg1: any): CompletionStage<U>;
    whenComplete(arg0: (a: any, b: any) => void): CompletionStage<T>;
    whenCompleteAsync(arg0: (a: any, b: any) => void): CompletionStage<T>;
    whenCompleteAsync(arg0: (a: any, b: any) => void, arg1: any): CompletionStage<T>;
    exceptionally(arg0: (arg: any) => T): CompletionStage<T>;
    exceptionallyAsync(arg0: (arg: any) => T): CompletionStage<T>;
    exceptionallyAsync(arg0: (arg: any) => T, arg1: any): CompletionStage<T>;
    exceptionallyCompose(arg0: (arg: any) => CompletionStage<T>): CompletionStage<T>;
    exceptionallyComposeAsync(arg0: (arg: any) => CompletionStage<T>): CompletionStage<T>;
    exceptionallyComposeAsync(arg0: (arg: any) => CompletionStage<T>, arg1: any): CompletionStage<T>;
    toCompletableFuture(): Promise<T>;
  }
}

declare module "java:java.util.concurrent.ConcurrentHashMap" {
  export class ConcurrentHashMap<K, V> {
    constructor();
    constructor(arg0: number);
    constructor(arg0: Map<K, V>);
    constructor(arg0: number, arg1: number);
    constructor(arg0: number, arg1: number, arg2: number);
    size(): number;
    isEmpty(): boolean;
    get(arg0: any): V;
    containsKey(arg0: any): boolean;
    containsValue(arg0: any): boolean;
    put(arg0: K, arg1: V): V;
    putAll(arg0: Map<K, V>): void;
    remove(arg0: any): V;
    clear(): void;
    keySet(): ConcurrentHashMap$KeySetView<K, V>;
    values(): V[];
    entrySet(): Set<Map$Entry<K, V>>;
    hashCode(): number;
    toString(): string;
    equals(arg0: any): boolean;
    putIfAbsent(arg0: K, arg1: V): V;
    remove(arg0: any, arg1: any): boolean;
    replace(arg0: K, arg1: V, arg2: V): boolean;
    replace(arg0: K, arg1: V): V;
    getOrDefault(arg0: any, arg1: V): V;
    forEach(arg0: (a: any, b: any) => void): void;
    replaceAll(arg0: (a: any, b: any) => V): void;
    computeIfAbsent(arg0: K, arg1: (arg: any) => V): V;
    computeIfPresent(arg0: K, arg1: (a: any, b: any) => V): V;
    compute(arg0: K, arg1: (a: any, b: any) => V): V;
    merge(arg0: K, arg1: V, arg2: (a: any, b: any) => V): V;
    contains(arg0: any): boolean;
    keys(): Iterable<K>;
    elements(): Iterable<V>;
    mappingCount(): number;
    keySet(arg0: V): ConcurrentHashMap$KeySetView<K, V>;
    forEach(arg0: number, arg1: (a: any, b: any) => void): void;
    forEach<U>(arg0: number, arg1: (a: any, b: any) => U, arg2: (value: any) => void): void;
    search<U>(arg0: number, arg1: (a: any, b: any) => U): U;
    reduce<U>(arg0: number, arg1: (a: any, b: any) => U, arg2: (a: any, b: any) => U): U;
    reduceToDouble(arg0: number, arg1: ToDoubleBiFunction<any, any>, arg2: number, arg3: any): number;
    reduceToLong(arg0: number, arg1: ToLongBiFunction<any, any>, arg2: number, arg3: any): number;
    reduceToInt(arg0: number, arg1: ToIntBiFunction<any, any>, arg2: number, arg3: any): number;
    forEachKey(arg0: number, arg1: (value: any) => void): void;
    forEachKey<U>(arg0: number, arg1: (arg: any) => U, arg2: (value: any) => void): void;
    searchKeys<U>(arg0: number, arg1: (arg: any) => U): U;
    reduceKeys(arg0: number, arg1: (a: any, b: any) => K): K;
    reduceKeys<U>(arg0: number, arg1: (arg: any) => U, arg2: (a: any, b: any) => U): U;
    reduceKeysToDouble(arg0: number, arg1: ToDoubleFunction<any>, arg2: number, arg3: any): number;
    reduceKeysToLong(arg0: number, arg1: ToLongFunction<any>, arg2: number, arg3: any): number;
    reduceKeysToInt(arg0: number, arg1: ToIntFunction<any>, arg2: number, arg3: any): number;
    forEachValue(arg0: number, arg1: (value: any) => void): void;
    forEachValue<U>(arg0: number, arg1: (arg: any) => U, arg2: (value: any) => void): void;
    searchValues<U>(arg0: number, arg1: (arg: any) => U): U;
    reduceValues(arg0: number, arg1: (a: any, b: any) => V): V;
    reduceValues<U>(arg0: number, arg1: (arg: any) => U, arg2: (a: any, b: any) => U): U;
    reduceValuesToDouble(arg0: number, arg1: ToDoubleFunction<any>, arg2: number, arg3: any): number;
    reduceValuesToLong(arg0: number, arg1: ToLongFunction<any>, arg2: number, arg3: any): number;
    reduceValuesToInt(arg0: number, arg1: ToIntFunction<any>, arg2: number, arg3: any): number;
    forEachEntry(arg0: number, arg1: (value: Map$Entry<K, V>) => void): void;
    forEachEntry<U>(arg0: number, arg1: (arg: Map$Entry<K, V>) => U, arg2: (value: any) => void): void;
    searchEntries<U>(arg0: number, arg1: (arg: Map$Entry<K, V>) => U): U;
    reduceEntries(arg0: number, arg1: (a: Map$Entry<K, V>, b: Map$Entry<K, V>) => Map$Entry<K, V>): Map$Entry<K, V>;
    reduceEntries<U>(arg0: number, arg1: (arg: Map$Entry<K, V>) => U, arg2: (a: any, b: any) => U): U;
    reduceEntriesToDouble(arg0: number, arg1: ToDoubleFunction<Map$Entry<K, V>>, arg2: number, arg3: any): number;
    reduceEntriesToLong(arg0: number, arg1: ToLongFunction<Map$Entry<K, V>>, arg2: number, arg3: any): number;
    reduceEntriesToInt(arg0: number, arg1: ToIntFunction<Map$Entry<K, V>>, arg2: number, arg3: any): number;
    keySet(): any;
    static newKeySet<K>(): ConcurrentHashMap$KeySetView<K, boolean>;
    static newKeySet<K>(arg0: number): ConcurrentHashMap$KeySetView<K, boolean>;
  }
}

declare module "java:java.util.concurrent.ConcurrentLinkedDeque" {
  export class ConcurrentLinkedDeque<E> {
    constructor();
    constructor(arg0: E[]);
    addFirst(arg0: E): void;
    addLast(arg0: E): void;
    offerFirst(arg0: E): boolean;
    offerLast(arg0: E): boolean;
    peekFirst(): E;
    peekLast(): E;
    getFirst(): E;
    getLast(): E;
    pollFirst(): E;
    pollLast(): E;
    removeFirst(): E;
    removeLast(): E;
    offer(arg0: E): boolean;
    add(arg0: E): boolean;
    poll(): E;
    peek(): E;
    remove(): E;
    pop(): E;
    element(): E;
    push(arg0: E): void;
    removeFirstOccurrence(arg0: any): boolean;
    removeLastOccurrence(arg0: any): boolean;
    contains(arg0: any): boolean;
    isEmpty(): boolean;
    size(): number;
    remove(arg0: any): boolean;
    addAll(arg0: E[]): boolean;
    clear(): void;
    toString(): string;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    iterator(): Iterable<E>;
    descendingIterator(): Iterable<E>;
    spliterator(): Spliterator<E>;
    removeIf(arg0: (value: any) => boolean): boolean;
    removeAll(arg0: any[]): boolean;
    retainAll(arg0: any[]): boolean;
    forEach(arg0: (value: any) => void): void;
  }
}

declare module "java:java.util.concurrent.ConcurrentLinkedQueue" {
  export class ConcurrentLinkedQueue<E> {
    constructor();
    constructor(arg0: E[]);
    add(arg0: E): boolean;
    offer(arg0: E): boolean;
    poll(): E;
    peek(): E;
    isEmpty(): boolean;
    size(): number;
    contains(arg0: any): boolean;
    remove(arg0: any): boolean;
    addAll(arg0: E[]): boolean;
    toString(): string;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    iterator(): Iterable<E>;
    spliterator(): Spliterator<E>;
    removeIf(arg0: (value: any) => boolean): boolean;
    removeAll(arg0: any[]): boolean;
    retainAll(arg0: any[]): boolean;
    clear(): void;
    forEach(arg0: (value: any) => void): void;
  }
}

declare module "java:java.util.concurrent.ConcurrentMap" {
  export class ConcurrentMap<K, V> {
    getOrDefault(arg0: any, arg1: V): V;
    forEach(arg0: (a: any, b: any) => void): void;
    putIfAbsent(arg0: K, arg1: V): V;
    remove(arg0: any, arg1: any): boolean;
    replace(arg0: K, arg1: V, arg2: V): boolean;
    replace(arg0: K, arg1: V): V;
    replaceAll(arg0: (a: any, b: any) => V): void;
    computeIfAbsent(arg0: K, arg1: (arg: any) => V): V;
    computeIfPresent(arg0: K, arg1: (a: any, b: any) => V): V;
    compute(arg0: K, arg1: (a: any, b: any) => V): V;
    merge(arg0: K, arg1: V, arg2: (a: any, b: any) => V): V;
  }
}

declare module "java:java.util.concurrent.ConcurrentNavigableMap" {
  export class ConcurrentNavigableMap<K, V> {
    subMap(arg0: K, arg1: boolean, arg2: K, arg3: boolean): ConcurrentNavigableMap<K, V>;
    headMap(arg0: K, arg1: boolean): ConcurrentNavigableMap<K, V>;
    tailMap(arg0: K, arg1: boolean): ConcurrentNavigableMap<K, V>;
    subMap(arg0: K, arg1: K): ConcurrentNavigableMap<K, V>;
    headMap(arg0: K): ConcurrentNavigableMap<K, V>;
    tailMap(arg0: K): ConcurrentNavigableMap<K, V>;
    descendingMap(): ConcurrentNavigableMap<K, V>;
    navigableKeySet(): NavigableSet<K>;
    keySet(): NavigableSet<K>;
    descendingKeySet(): NavigableSet<K>;
    keySet(): any;
    tailMap(arg0: any): any;
    headMap(arg0: any): any;
    subMap(arg0: any, arg1: any): any;
    tailMap(arg0: any, arg1: boolean): any;
    headMap(arg0: any, arg1: boolean): any;
    subMap(arg0: any, arg1: boolean, arg2: any, arg3: boolean): any;
    descendingMap(): any;
  }
}

declare module "java:java.util.concurrent.ConcurrentSkipListMap" {
  export class ConcurrentSkipListMap<K, V> {
    constructor();
    constructor(arg0: Comparator<any>);
    constructor(arg0: Map<K, V>);
    constructor(arg0: SortedMap<K, V>);
    clone(): ConcurrentSkipListMap<K, V>;
    containsKey(arg0: any): boolean;
    get(arg0: any): V;
    getOrDefault(arg0: any, arg1: V): V;
    put(arg0: K, arg1: V): V;
    remove(arg0: any): V;
    containsValue(arg0: any): boolean;
    size(): number;
    isEmpty(): boolean;
    clear(): void;
    computeIfAbsent(arg0: K, arg1: (arg: any) => V): V;
    computeIfPresent(arg0: K, arg1: (a: any, b: any) => V): V;
    compute(arg0: K, arg1: (a: any, b: any) => V): V;
    merge(arg0: K, arg1: V, arg2: (a: any, b: any) => V): V;
    keySet(): NavigableSet<K>;
    navigableKeySet(): NavigableSet<K>;
    values(): V[];
    entrySet(): Set<Map$Entry<K, V>>;
    descendingMap(): ConcurrentNavigableMap<K, V>;
    descendingKeySet(): NavigableSet<K>;
    equals(arg0: any): boolean;
    putIfAbsent(arg0: K, arg1: V): V;
    remove(arg0: any, arg1: any): boolean;
    replace(arg0: K, arg1: V, arg2: V): boolean;
    replace(arg0: K, arg1: V): V;
    comparator(): Comparator<any>;
    firstKey(): K;
    lastKey(): K;
    putFirst(arg0: K, arg1: V): V;
    putLast(arg0: K, arg1: V): V;
    subMap(arg0: K, arg1: boolean, arg2: K, arg3: boolean): ConcurrentNavigableMap<K, V>;
    headMap(arg0: K, arg1: boolean): ConcurrentNavigableMap<K, V>;
    tailMap(arg0: K, arg1: boolean): ConcurrentNavigableMap<K, V>;
    subMap(arg0: K, arg1: K): ConcurrentNavigableMap<K, V>;
    headMap(arg0: K): ConcurrentNavigableMap<K, V>;
    tailMap(arg0: K): ConcurrentNavigableMap<K, V>;
    lowerEntry(arg0: K): Map$Entry<K, V>;
    lowerKey(arg0: K): K;
    floorEntry(arg0: K): Map$Entry<K, V>;
    floorKey(arg0: K): K;
    ceilingEntry(arg0: K): Map$Entry<K, V>;
    ceilingKey(arg0: K): K;
    higherEntry(arg0: K): Map$Entry<K, V>;
    higherKey(arg0: K): K;
    firstEntry(): Map$Entry<K, V>;
    lastEntry(): Map$Entry<K, V>;
    pollFirstEntry(): Map$Entry<K, V>;
    pollLastEntry(): Map$Entry<K, V>;
    forEach(arg0: (a: any, b: any) => void): void;
    replaceAll(arg0: (a: any, b: any) => V): void;
    clone(): any;
    keySet(): any;
    tailMap(arg0: any): any;
    headMap(arg0: any): any;
    subMap(arg0: any, arg1: any): any;
    tailMap(arg0: any, arg1: boolean): any;
    headMap(arg0: any, arg1: boolean): any;
    subMap(arg0: any, arg1: boolean, arg2: any, arg3: boolean): any;
    descendingMap(): any;
  }
}

declare module "java:java.util.concurrent.ConcurrentSkipListSet" {
  export class ConcurrentSkipListSet<E> {
    constructor();
    constructor(arg0: Comparator<any>);
    constructor(arg0: E[]);
    constructor(arg0: SortedSet<E>);
    clone(): ConcurrentSkipListSet<E>;
    size(): number;
    isEmpty(): boolean;
    contains(arg0: any): boolean;
    add(arg0: E): boolean;
    remove(arg0: any): boolean;
    clear(): void;
    iterator(): Iterable<E>;
    descendingIterator(): Iterable<E>;
    equals(arg0: any): boolean;
    removeAll(arg0: any[]): boolean;
    lower(arg0: E): E;
    floor(arg0: E): E;
    ceiling(arg0: E): E;
    higher(arg0: E): E;
    pollFirst(): E;
    pollLast(): E;
    comparator(): Comparator<any>;
    first(): E;
    last(): E;
    addFirst(arg0: E): void;
    addLast(arg0: E): void;
    subSet(arg0: E, arg1: boolean, arg2: E, arg3: boolean): NavigableSet<E>;
    headSet(arg0: E, arg1: boolean): NavigableSet<E>;
    tailSet(arg0: E, arg1: boolean): NavigableSet<E>;
    subSet(arg0: E, arg1: E): NavigableSet<E>;
    headSet(arg0: E): NavigableSet<E>;
    tailSet(arg0: E): NavigableSet<E>;
    descendingSet(): NavigableSet<E>;
    spliterator(): Spliterator<E>;
    clone(): any;
    tailSet(arg0: any): any;
    headSet(arg0: any): any;
    subSet(arg0: any, arg1: any): any;
  }
}

declare module "java:java.util.concurrent.CopyOnWriteArrayList" {
  export class CopyOnWriteArrayList<E> {
    constructor();
    constructor(arg0: E[]);
    constructor(arg0: E[]);
    size(): number;
    isEmpty(): boolean;
    contains(arg0: any): boolean;
    indexOf(arg0: any): number;
    indexOf(arg0: E, arg1: number): number;
    lastIndexOf(arg0: any): number;
    lastIndexOf(arg0: E, arg1: number): number;
    clone(): any;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    get(arg0: number): E;
    getFirst(): E;
    getLast(): E;
    set(arg0: number, arg1: E): E;
    add(arg0: E): boolean;
    add(arg0: number, arg1: E): void;
    addFirst(arg0: E): void;
    addLast(arg0: E): void;
    remove(arg0: number): E;
    removeFirst(): E;
    removeLast(): E;
    remove(arg0: any): boolean;
    addIfAbsent(arg0: E): boolean;
    containsAll(arg0: any[]): boolean;
    removeAll(arg0: any[]): boolean;
    retainAll(arg0: any[]): boolean;
    addAllAbsent(arg0: E[]): number;
    clear(): void;
    addAll(arg0: E[]): boolean;
    addAll(arg0: number, arg1: E[]): boolean;
    forEach(arg0: (value: any) => void): void;
    removeIf(arg0: (value: any) => boolean): boolean;
    replaceAll(arg0: (arg: E) => any): void;
    sort(arg0: Comparator<any>): void;
    toString(): string;
    equals(arg0: any): boolean;
    hashCode(): number;
    iterator(): Iterable<E>;
    listIterator(): ListIterator<E>;
    listIterator(arg0: number): ListIterator<E>;
    spliterator(): Spliterator<E>;
    subList(arg0: number, arg1: number): E[];
    reversed(): E[];
    reversed(): any;
  }
}

declare module "java:java.util.concurrent.CopyOnWriteArraySet" {
  export class CopyOnWriteArraySet<E> {
    constructor();
    constructor(arg0: E[]);
    size(): number;
    isEmpty(): boolean;
    contains(arg0: any): boolean;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    clear(): void;
    remove(arg0: any): boolean;
    add(arg0: E): boolean;
    containsAll(arg0: any[]): boolean;
    addAll(arg0: E[]): boolean;
    removeAll(arg0: any[]): boolean;
    retainAll(arg0: any[]): boolean;
    iterator(): Iterable<E>;
    equals(arg0: any): boolean;
    removeIf(arg0: (value: any) => boolean): boolean;
    forEach(arg0: (value: any) => void): void;
    spliterator(): Spliterator<E>;
  }
}

declare module "java:java.util.concurrent.CountDownLatch" {
  export class CountDownLatch {
    constructor(arg0: number);
    await(): void;
    await(arg0: number, arg1: any): boolean;
    countDown(): void;
    getCount(): number;
    toString(): string;
  }
}

declare module "java:java.util.concurrent.CountedCompleter" {
  export class CountedCompleter<T> {
    compute(): void;
    onCompletion(arg0: CountedCompleter<any>): void;
    onExceptionalCompletion(arg0: any, arg1: CountedCompleter<any>): boolean;
    getCompleter(): CountedCompleter<any>;
    getPendingCount(): number;
    setPendingCount(arg0: number): void;
    addToPendingCount(arg0: number): void;
    compareAndSetPendingCount(arg0: number, arg1: number): boolean;
    decrementPendingCountUnlessZero(): number;
    getRoot(): CountedCompleter<any>;
    tryComplete(): void;
    propagateCompletion(): void;
    complete(arg0: T): void;
    firstComplete(): CountedCompleter<any>;
    nextComplete(): CountedCompleter<any>;
    quietlyCompleteRoot(): void;
    helpComplete(arg0: number): void;
    getRawResult(): T;
  }
}

declare module "java:java.util.concurrent.CyclicBarrier" {
  export class CyclicBarrier {
    constructor(arg0: number, arg1: any);
    constructor(arg0: number);
    getParties(): number;
    await(): number;
    await(arg0: number, arg1: any): number;
    isBroken(): boolean;
    reset(): void;
    getNumberWaiting(): number;
  }
}

declare module "java:java.util.concurrent.DelayQueue" {
  export class DelayQueue<E> {
    constructor();
    constructor(arg0: E[]);
    add(arg0: E): boolean;
    offer(arg0: E): boolean;
    put(arg0: E): void;
    offer(arg0: E, arg1: number, arg2: any): boolean;
    poll(): E;
    take(): E;
    poll(arg0: number, arg1: any): E;
    remove(): E;
    peek(): E;
    size(): number;
    drainTo(arg0: any[]): number;
    drainTo(arg0: any[], arg1: number): number;
    clear(): void;
    remainingCapacity(): number;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    remove(arg0: any): boolean;
    iterator(): Iterable<E>;
    remove(): any;
    add(arg0: any): boolean;
    peek(): any;
    poll(): any;
    offer(arg0: any): boolean;
    poll(arg0: number, arg1: any): any;
    take(): any;
    offer(arg0: any, arg1: number, arg2: any): boolean;
    put(arg0: any): void;
  }
}

declare module "java:java.util.concurrent.DelayScheduler" {
  export class DelayScheduler {
    run(): void;
  }
}

declare module "java:java.util.concurrent.Delayed" {
  export class Delayed<java.util.concurrent.Delayed> {
    getDelay(arg0: any): number;
  }
}

declare module "java:java.util.concurrent.Exchanger" {
  export class Exchanger<V> {
    constructor();
    exchange(arg0: V): V;
    exchange(arg0: V, arg1: number, arg2: any): V;
  }
}

declare module "java:java.util.concurrent.ExecutionException" {
  export class ExecutionException {
    constructor(arg0: string, arg1: any);
    constructor(arg0: any);
  }
}

declare module "java:java.util.concurrent.Executor" {
  export class Executor {
    execute(arg0: any): void;
  }
}

declare module "java:java.util.concurrent.ExecutorCompletionService" {
  export class ExecutorCompletionService<V> {
    constructor(arg0: any);
    constructor(arg0: any, arg1: BlockingQueue<Promise<V>>);
    submit(arg0: Callable<V>): Promise<V>;
    submit(arg0: any, arg1: V): Promise<V>;
    take(): Promise<V>;
    poll(): Promise<V>;
    poll(arg0: number, arg1: any): Promise<V>;
  }
}

declare module "java:java.util.concurrent.ExecutorService" {
  export class ExecutorService {
    shutdown(): void;
    shutdownNow(): any[];
    isShutdown(): boolean;
    isTerminated(): boolean;
    awaitTermination(arg0: number, arg1: any): boolean;
    submit<T>(arg0: Callable<T>): Promise<T>;
    submit<T>(arg0: any, arg1: T): Promise<T>;
    submit(arg0: any): Promise<any>;
    invokeAll<T>(arg0: Callable<T>[]): Promise<T>[];
    invokeAll<T>(arg0: Callable<T>[], arg1: number, arg2: any): Promise<T>[];
    invokeAny<T>(arg0: Callable<T>[]): T;
    invokeAny<T>(arg0: Callable<T>[], arg1: number, arg2: any): T;
    close(): void;
  }
}

declare module "java:java.util.concurrent.Executors" {
  export const Executors: {
    newFixedThreadPool(arg0: number): any;
    newWorkStealingPool(arg0: number): any;
    newWorkStealingPool(): any;
    newFixedThreadPool(arg0: number, arg1: any): any;
    newSingleThreadExecutor(): any;
    newSingleThreadExecutor(arg0: any): any;
    newCachedThreadPool(): any;
    newCachedThreadPool(arg0: any): any;
    newThreadPerTaskExecutor(arg0: any): any;
    newVirtualThreadPerTaskExecutor(): any;
    newSingleThreadScheduledExecutor(): any;
    newSingleThreadScheduledExecutor(arg0: any): any;
    newScheduledThreadPool(arg0: number): any;
    newScheduledThreadPool(arg0: number, arg1: any): any;
    unconfigurableExecutorService(arg0: any): any;
    unconfigurableScheduledExecutorService(arg0: any): any;
    defaultThreadFactory(): any;
    privilegedThreadFactory(): any;
    callable<T>(arg0: any, arg1: T): Callable<T>;
    callable(arg0: any): Callable<any>;
    callable(arg0: PrivilegedAction<any>): Callable<any>;
    callable(arg0: PrivilegedExceptionAction<any>): Callable<any>;
    privilegedCallable<T>(arg0: Callable<T>): Callable<T>;
    privilegedCallableUsingCurrentClassLoader<T>(arg0: Callable<T>): Callable<T>;
  };
}

declare module "java:java.util.concurrent.Flow" {
  export const Flow: {
    defaultBufferSize(): number;
  };
}

declare module "java:java.util.concurrent.ForkJoinPool" {
  export class ForkJoinPool {
    constructor();
    constructor(arg0: number);
    constructor(arg0: number, arg1: ForkJoinPoolForkJoinWorkerThreadFactory, arg2: ThreadUncaughtExceptionHandler, arg3: boolean);
    constructor(arg0: number, arg1: ForkJoinPoolForkJoinWorkerThreadFactory, arg2: ThreadUncaughtExceptionHandler, arg3: boolean, arg4: number, arg5: number, arg6: number, arg7: (value: any) => boolean, arg8: number, arg9: any);
    invoke<T>(arg0: ForkJoinTask<T>): T;
    execute(arg0: ForkJoinTask<any>): void;
    execute(arg0: any): void;
    submit<T>(arg0: ForkJoinTask<T>): ForkJoinTask<T>;
    submit<T>(arg0: Callable<T>): ForkJoinTask<T>;
    submit<T>(arg0: any, arg1: T): ForkJoinTask<T>;
    submit(arg0: any): ForkJoinTask<any>;
    externalSubmit<T>(arg0: ForkJoinTask<T>): ForkJoinTask<T>;
    lazySubmit<T>(arg0: ForkJoinTask<T>): ForkJoinTask<T>;
    setParallelism(arg0: number): number;
    invokeAllUninterruptibly<T>(arg0: Callable<T>[]): Promise<T>[];
    invokeAll<T>(arg0: Callable<T>[]): Promise<T>[];
    invokeAll<T>(arg0: Callable<T>[], arg1: number, arg2: any): Promise<T>[];
    invokeAny<T>(arg0: Callable<T>[]): T;
    invokeAny<T>(arg0: Callable<T>[], arg1: number, arg2: any): T;
    schedule(arg0: any, arg1: number, arg2: any): ScheduledFuture<any>;
    schedule<V>(arg0: Callable<V>, arg1: number, arg2: any): ScheduledFuture<V>;
    scheduleAtFixedRate(arg0: any, arg1: number, arg2: number, arg3: any): ScheduledFuture<any>;
    scheduleWithFixedDelay(arg0: any, arg1: number, arg2: number, arg3: any): ScheduledFuture<any>;
    submitWithTimeout<V>(arg0: Callable<V>, arg1: number, arg2: any, arg3: (value: ForkJoinTask<V>) => void): ForkJoinTask<V>;
    cancelDelayedTasksOnShutdown(): void;
    getFactory(): ForkJoinPoolForkJoinWorkerThreadFactory;
    getUncaughtExceptionHandler(): ThreadUncaughtExceptionHandler;
    getParallelism(): number;
    getPoolSize(): number;
    getAsyncMode(): boolean;
    getRunningThreadCount(): number;
    getActiveThreadCount(): number;
    isQuiescent(): boolean;
    getStealCount(): number;
    getQueuedTaskCount(): number;
    getQueuedSubmissionCount(): number;
    getDelayedTaskCount(): number;
    hasQueuedSubmissions(): boolean;
    toString(): string;
    shutdown(): void;
    shutdownNow(): any[];
    isTerminated(): boolean;
    isTerminating(): boolean;
    isShutdown(): boolean;
    awaitTermination(arg0: number, arg1: any): boolean;
    awaitQuiescence(arg0: number, arg1: any): boolean;
    close(): void;
    submit(arg0: any): any;
    submit(arg0: any, arg1: any): any;
    submit(arg0: any): any;
    static commonPool(): any;
    static getCommonPoolParallelism(): number;
    static managedBlock(arg0: ForkJoinPoolManagedBlocker): void;
    static defaultForkJoinWorkerThreadFactory: ForkJoinPoolForkJoinWorkerThreadFactory;
  }
}

declare module "java:java.util.concurrent.ForkJoinTask" {
  export class ForkJoinTask<V> {
    constructor();
    fork(): ForkJoinTask<V>;
    join(): V;
    invoke(): V;
    cancel(arg0: boolean): boolean;
    isDone(): boolean;
    isCancelled(): boolean;
    isCompletedAbnormally(): boolean;
    isCompletedNormally(): boolean;
    state(): FutureState;
    resultNow(): V;
    exceptionNow(): any;
    getException(): any;
    completeExceptionally(arg0: any): void;
    complete(arg0: V): void;
    quietlyComplete(): void;
    get(): V;
    get(arg0: number, arg1: any): V;
    quietlyJoin(): void;
    quietlyInvoke(): void;
    quietlyJoin(arg0: number, arg1: any): boolean;
    quietlyJoinUninterruptibly(arg0: number, arg1: any): boolean;
    reinitialize(): void;
    tryUnfork(): boolean;
    getRawResult(): V;
    getForkJoinTaskTag(): number;
    setForkJoinTaskTag(arg0: number): number;
    compareAndSetForkJoinTaskTag(arg0: number, arg1: number): boolean;
    static invokeAll(arg0: ForkJoinTask<any>, arg1: ForkJoinTask<any>): void;
    static invokeAll(arg0: ForkJoinTask<any>[]): void;
    static invokeAll(arg0: T[]): ForkJoinTask<any>;
    static helpQuiesce(): void;
    static getPool(): any;
    static inForkJoinPool(): boolean;
    static getQueuedTaskCount(): number;
    static getSurplusQueuedTaskCount(): number;
    static adapt(arg0: any): ForkJoinTask<any>;
    static adapt<T>(arg0: any, arg1: T): ForkJoinTask<T>;
    static adapt<T>(arg0: Callable<T>): ForkJoinTask<T>;
    static adaptInterruptible<T>(arg0: Callable<T>): ForkJoinTask<T>;
    static adaptInterruptible<T>(arg0: any, arg1: T): ForkJoinTask<T>;
    static adaptInterruptible(arg0: any): ForkJoinTask<any>;
  }
}

declare module "java:java.util.concurrent.ForkJoinWorkerThread" {
  export class ForkJoinWorkerThread {
    getPool(): any;
    getPoolIndex(): number;
    getQueuedTaskCount(): number;
    run(): void;
  }
}

declare module "java:java.util.concurrent.Future" {
  export class Future<V> {
    cancel(arg0: boolean): boolean;
    isCancelled(): boolean;
    isDone(): boolean;
    get(): V;
    get(arg0: number, arg1: any): V;
    resultNow(): V;
    exceptionNow(): any;
    state(): FutureState;
  }
}

declare module "java:java.util.concurrent.FutureTask" {
  export class FutureTask<V> {
    constructor(arg0: Callable<V>);
    constructor(arg0: any, arg1: V);
    isCancelled(): boolean;
    isDone(): boolean;
    cancel(arg0: boolean): boolean;
    get(): V;
    get(arg0: number, arg1: any): V;
    resultNow(): V;
    exceptionNow(): any;
    state(): FutureState;
    run(): void;
    toString(): string;
  }
}

declare module "java:java.util.concurrent.Helpers" {
  export const Helpers: {
  };
}

declare module "java:java.util.concurrent.Joiners" {
  export const Joiners: {
  };
}

declare module "java:java.util.concurrent.LinkedBlockingDeque" {
  export class LinkedBlockingDeque<E> {
    constructor();
    constructor(arg0: number);
    constructor(arg0: E[]);
    addFirst(arg0: E): void;
    addLast(arg0: E): void;
    offerFirst(arg0: E): boolean;
    offerLast(arg0: E): boolean;
    putFirst(arg0: E): void;
    putLast(arg0: E): void;
    offerFirst(arg0: E, arg1: number, arg2: any): boolean;
    offerLast(arg0: E, arg1: number, arg2: any): boolean;
    removeFirst(): E;
    removeLast(): E;
    pollFirst(): E;
    pollLast(): E;
    takeFirst(): E;
    takeLast(): E;
    pollFirst(arg0: number, arg1: any): E;
    pollLast(arg0: number, arg1: any): E;
    getFirst(): E;
    getLast(): E;
    peekFirst(): E;
    peekLast(): E;
    removeFirstOccurrence(arg0: any): boolean;
    removeLastOccurrence(arg0: any): boolean;
    add(arg0: E): boolean;
    offer(arg0: E): boolean;
    put(arg0: E): void;
    offer(arg0: E, arg1: number, arg2: any): boolean;
    remove(): E;
    poll(): E;
    take(): E;
    poll(arg0: number, arg1: any): E;
    element(): E;
    peek(): E;
    remainingCapacity(): number;
    drainTo(arg0: any[]): number;
    drainTo(arg0: any[], arg1: number): number;
    push(arg0: E): void;
    pop(): E;
    remove(arg0: any): boolean;
    size(): number;
    contains(arg0: any): boolean;
    addAll(arg0: E[]): boolean;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    toString(): string;
    clear(): void;
    iterator(): Iterable<E>;
    descendingIterator(): Iterable<E>;
    spliterator(): Spliterator<E>;
    forEach(arg0: (value: any) => void): void;
    removeIf(arg0: (value: any) => boolean): boolean;
    removeAll(arg0: any[]): boolean;
    retainAll(arg0: any[]): boolean;
  }
}

declare module "java:java.util.concurrent.LinkedBlockingQueue" {
  export class LinkedBlockingQueue<E> {
    constructor();
    constructor(arg0: number);
    constructor(arg0: E[]);
    size(): number;
    remainingCapacity(): number;
    put(arg0: E): void;
    offer(arg0: E, arg1: number, arg2: any): boolean;
    offer(arg0: E): boolean;
    take(): E;
    poll(arg0: number, arg1: any): E;
    poll(): E;
    peek(): E;
    remove(arg0: any): boolean;
    contains(arg0: any): boolean;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    toString(): string;
    clear(): void;
    drainTo(arg0: any[]): number;
    drainTo(arg0: any[], arg1: number): number;
    iterator(): Iterable<E>;
    spliterator(): Spliterator<E>;
    forEach(arg0: (value: any) => void): void;
    removeIf(arg0: (value: any) => boolean): boolean;
    removeAll(arg0: any[]): boolean;
    retainAll(arg0: any[]): boolean;
  }
}

declare module "java:java.util.concurrent.LinkedTransferQueue" {
  export class LinkedTransferQueue<E> {
    constructor();
    constructor(arg0: E[]);
    toString(): string;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    spliterator(): Spliterator<E>;
    put(arg0: E): void;
    offer(arg0: E, arg1: number, arg2: any): boolean;
    offer(arg0: E): boolean;
    add(arg0: E): boolean;
    tryTransfer(arg0: E): boolean;
    transfer(arg0: E): void;
    tryTransfer(arg0: E, arg1: number, arg2: any): boolean;
    take(): E;
    poll(arg0: number, arg1: any): E;
    poll(): E;
    drainTo(arg0: any[]): number;
    drainTo(arg0: any[], arg1: number): number;
    iterator(): Iterable<E>;
    peek(): E;
    isEmpty(): boolean;
    hasWaitingConsumer(): boolean;
    size(): number;
    getWaitingConsumerCount(): number;
    remove(arg0: any): boolean;
    contains(arg0: any): boolean;
    remainingCapacity(): number;
    removeIf(arg0: (value: any) => boolean): boolean;
    removeAll(arg0: any[]): boolean;
    retainAll(arg0: any[]): boolean;
    clear(): void;
    forEach(arg0: (value: any) => void): void;
  }
}

declare module "java:java.util.concurrent.Phaser" {
  export class Phaser {
    constructor();
    constructor(arg0: number);
    constructor(arg0: any);
    constructor(arg0: any, arg1: number);
    register(): number;
    bulkRegister(arg0: number): number;
    arrive(): number;
    arriveAndDeregister(): number;
    arriveAndAwaitAdvance(): number;
    awaitAdvance(arg0: number): number;
    awaitAdvanceInterruptibly(arg0: number): number;
    awaitAdvanceInterruptibly(arg0: number, arg1: number, arg2: any): number;
    forceTermination(): void;
    getPhase(): number;
    getRegisteredParties(): number;
    getArrivedParties(): number;
    getUnarrivedParties(): number;
    getParent(): any;
    getRoot(): any;
    isTerminated(): boolean;
    toString(): string;
  }
}

declare module "java:java.util.concurrent.PriorityBlockingQueue" {
  export class PriorityBlockingQueue<E> {
    constructor();
    constructor(arg0: number);
    constructor(arg0: number, arg1: Comparator<any>);
    constructor(arg0: E[]);
    add(arg0: E): boolean;
    offer(arg0: E): boolean;
    put(arg0: E): void;
    offer(arg0: E, arg1: number, arg2: any): boolean;
    poll(): E;
    take(): E;
    poll(arg0: number, arg1: any): E;
    peek(): E;
    comparator(): Comparator<any>;
    size(): number;
    remainingCapacity(): number;
    remove(arg0: any): boolean;
    contains(arg0: any): boolean;
    toString(): string;
    drainTo(arg0: any[]): number;
    drainTo(arg0: any[], arg1: number): number;
    clear(): void;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    iterator(): Iterable<E>;
    spliterator(): Spliterator<E>;
    removeIf(arg0: (value: any) => boolean): boolean;
    removeAll(arg0: any[]): boolean;
    retainAll(arg0: any[]): boolean;
    forEach(arg0: (value: any) => void): void;
  }
}

declare module "java:java.util.concurrent.RecursiveAction" {
  export class RecursiveAction<java.lang.Void> {
    constructor();
    getRawResult(): void;
    getRawResult(): any;
  }
}

declare module "java:java.util.concurrent.RecursiveTask" {
  export class RecursiveTask<V> {
    constructor();
    getRawResult(): V;
  }
}

declare module "java:java.util.concurrent.RejectedExecutionException" {
  export class RejectedExecutionException {
    constructor();
    constructor(arg0: string);
    constructor(arg0: string, arg1: any);
    constructor(arg0: any);
  }
}

declare module "java:java.util.concurrent.RejectedExecutionHandler" {
  export class RejectedExecutionHandler {
    rejectedExecution(arg0: any, arg1: any): void;
  }
}

declare module "java:java.util.concurrent.RunnableFuture" {
  export class RunnableFuture<V> {
    run(): void;
  }
}

declare module "java:java.util.concurrent.RunnableScheduledFuture" {
  export class RunnableScheduledFuture<V> {
    isPeriodic(): boolean;
  }
}

declare module "java:java.util.concurrent.ScheduledExecutorService" {
  export class ScheduledExecutorService {
    schedule(arg0: any, arg1: number, arg2: any): ScheduledFuture<any>;
    schedule<V>(arg0: Callable<V>, arg1: number, arg2: any): ScheduledFuture<V>;
    scheduleAtFixedRate(arg0: any, arg1: number, arg2: number, arg3: any): ScheduledFuture<any>;
    scheduleWithFixedDelay(arg0: any, arg1: number, arg2: number, arg3: any): ScheduledFuture<any>;
  }
}

declare module "java:java.util.concurrent.ScheduledFuture" {
  export const ScheduledFuture: {
  };
}

declare module "java:java.util.concurrent.ScheduledThreadPoolExecutor" {
  export class ScheduledThreadPoolExecutor {
    constructor(arg0: number);
    constructor(arg0: number, arg1: any);
    constructor(arg0: number, arg1: any);
    constructor(arg0: number, arg1: any, arg2: any);
    schedule(arg0: any, arg1: number, arg2: any): ScheduledFuture<any>;
    schedule<V>(arg0: Callable<V>, arg1: number, arg2: any): ScheduledFuture<V>;
    scheduleAtFixedRate(arg0: any, arg1: number, arg2: number, arg3: any): ScheduledFuture<any>;
    scheduleWithFixedDelay(arg0: any, arg1: number, arg2: number, arg3: any): ScheduledFuture<any>;
    execute(arg0: any): void;
    submit(arg0: any): Promise<any>;
    submit<T>(arg0: any, arg1: T): Promise<T>;
    submit<T>(arg0: Callable<T>): Promise<T>;
    setContinueExistingPeriodicTasksAfterShutdownPolicy(arg0: boolean): void;
    getContinueExistingPeriodicTasksAfterShutdownPolicy(): boolean;
    setExecuteExistingDelayedTasksAfterShutdownPolicy(arg0: boolean): void;
    getExecuteExistingDelayedTasksAfterShutdownPolicy(): boolean;
    setRemoveOnCancelPolicy(arg0: boolean): void;
    getRemoveOnCancelPolicy(): boolean;
    shutdown(): void;
    shutdownNow(): any[];
    getQueue(): BlockingQueue<any>;
  }
}

declare module "java:java.util.concurrent.Semaphore" {
  export class Semaphore {
    constructor(arg0: number);
    constructor(arg0: number, arg1: boolean);
    acquire(): void;
    acquireUninterruptibly(): void;
    tryAcquire(): boolean;
    tryAcquire(arg0: number, arg1: any): boolean;
    release(): void;
    acquire(arg0: number): void;
    acquireUninterruptibly(arg0: number): void;
    tryAcquire(arg0: number): boolean;
    tryAcquire(arg0: number, arg1: number, arg2: any): boolean;
    release(arg0: number): void;
    availablePermits(): number;
    drainPermits(): number;
    isFair(): boolean;
    hasQueuedThreads(): boolean;
    getQueueLength(): number;
    toString(): string;
  }
}

declare module "java:java.util.concurrent.StructureViolationException" {
  export class StructureViolationException {
    constructor();
    constructor(arg0: string);
  }
}

declare module "java:java.util.concurrent.StructuredTaskScope" {
  export class StructuredTaskScope<T, R> {
    fork<U>(arg0: Callable<U>): StructuredTaskScope$Subtask<U>;
    fork<U>(arg0: any): StructuredTaskScope$Subtask<U>;
    join(): R;
    isCancelled(): boolean;
    close(): void;
    static open<T, R>(arg0: StructuredTaskScope$Joiner<any, R>, arg1: (arg: StructuredTaskScopeConfiguration) => StructuredTaskScopeConfiguration): StructuredTaskScope<T, R>;
    static open<T, R>(arg0: StructuredTaskScope$Joiner<any, R>): StructuredTaskScope<T, R>;
    static open<T>(): StructuredTaskScope<T, void>;
  }
}

declare module "java:java.util.concurrent.StructuredTaskScopeImpl" {
  export class StructuredTaskScopeImpl<T, R> {
    fork<U>(arg0: Callable<U>): StructuredTaskScope$Subtask<U>;
    fork<U>(arg0: any): StructuredTaskScope$Subtask<U>;
    join(): R;
    isCancelled(): boolean;
    close(): void;
    toString(): string;
  }
}

declare module "java:java.util.concurrent.SubmissionPublisher" {
  export class SubmissionPublisher<T> {
    constructor(arg0: any, arg1: number, arg2: (a: Flow$Subscriber<any>, b: any) => void);
    constructor(arg0: any, arg1: number);
    constructor();
    subscribe(arg0: Flow$Subscriber<any>): void;
    submit(arg0: T): number;
    offer(arg0: T, arg1: BiPredicate<Flow$Subscriber<any>, any>): number;
    offer(arg0: T, arg1: number, arg2: any, arg3: BiPredicate<Flow$Subscriber<any>, any>): number;
    close(): void;
    closeExceptionally(arg0: any): void;
    isClosed(): boolean;
    getClosedException(): any;
    hasSubscribers(): boolean;
    getNumberOfSubscribers(): number;
    getExecutor(): any;
    getMaxBufferCapacity(): number;
    getSubscribers(): Flow$Subscriber<any>[];
    isSubscribed(arg0: Flow$Subscriber<any>): boolean;
    estimateMinimumDemand(): number;
    estimateMaximumLag(): number;
    consume(arg0: (value: any) => void): Promise<void>;
  }
}

declare module "java:java.util.concurrent.SynchronousQueue" {
  export class SynchronousQueue<E> {
    constructor();
    constructor(arg0: boolean);
    put(arg0: E): void;
    offer(arg0: E, arg1: number, arg2: any): boolean;
    offer(arg0: E): boolean;
    take(): E;
    poll(arg0: number, arg1: any): E;
    poll(): E;
    isEmpty(): boolean;
    size(): number;
    remainingCapacity(): number;
    clear(): void;
    contains(arg0: any): boolean;
    remove(arg0: any): boolean;
    containsAll(arg0: any[]): boolean;
    removeAll(arg0: any[]): boolean;
    retainAll(arg0: any[]): boolean;
    peek(): E;
    iterator(): Iterable<E>;
    spliterator(): Spliterator<E>;
    toArray(): any[];
    toArray<T>(arg0: T[]): T[];
    toString(): string;
    drainTo(arg0: any[]): number;
    drainTo(arg0: any[], arg1: number): number;
  }
}

declare module "java:java.util.concurrent.ThreadFactory" {
  export class ThreadFactory {
    newThread(arg0: any): any;
  }
}

declare module "java:java.util.concurrent.ThreadLocalRandom" {
  export class ThreadLocalRandom {
    setSeed(arg0: number): void;
    nextBoolean(): boolean;
    nextInt(): number;
    nextInt(arg0: number): number;
    nextInt(arg0: number, arg1: number): number;
    nextLong(): number;
    nextLong(arg0: number): number;
    nextLong(arg0: number, arg1: number): number;
    nextFloat(): number;
    nextFloat(arg0: number): number;
    nextFloat(arg0: number, arg1: number): number;
    nextDouble(): number;
    nextDouble(arg0: number): number;
    nextDouble(arg0: number, arg1: number): number;
    ints(arg0: number): any;
    ints(): any;
    ints(arg0: number, arg1: number, arg2: number): any;
    ints(arg0: number, arg1: number): any;
    longs(arg0: number): any;
    longs(): any;
    longs(arg0: number, arg1: number, arg2: number): any;
    longs(arg0: number, arg1: number): any;
    doubles(arg0: number): any;
    doubles(): any;
    doubles(arg0: number, arg1: number, arg2: number): any;
    doubles(arg0: number, arg1: number): any;
    static current(): any;
  }
}

declare module "java:java.util.concurrent.ThreadPerTaskExecutor" {
  export class ThreadPerTaskExecutor {
    threads(): Stream<any>;
    threadCount(): number;
    shutdown(): void;
    shutdownNow(): any[];
    isShutdown(): boolean;
    isTerminated(): boolean;
    awaitTermination(arg0: number, arg1: any): boolean;
    close(): void;
    execute(arg0: any): void;
    submit<T>(arg0: Callable<T>): Promise<T>;
    submit(arg0: any): Promise<any>;
    submit<T>(arg0: any, arg1: T): Promise<T>;
    invokeAll<T>(arg0: Callable<T>[]): Promise<T>[];
    invokeAll<T>(arg0: Callable<T>[], arg1: number, arg2: any): Promise<T>[];
    invokeAny<T>(arg0: Callable<T>[]): T;
    invokeAny<T>(arg0: Callable<T>[], arg1: number, arg2: any): T;
  }
}

declare module "java:java.util.concurrent.ThreadPoolExecutor" {
  export class ThreadPoolExecutor {
    constructor(arg0: number, arg1: number, arg2: number, arg3: any, arg4: BlockingQueue<any>);
    constructor(arg0: number, arg1: number, arg2: number, arg3: any, arg4: BlockingQueue<any>, arg5: any);
    constructor(arg0: number, arg1: number, arg2: number, arg3: any, arg4: BlockingQueue<any>, arg5: any);
    constructor(arg0: number, arg1: number, arg2: number, arg3: any, arg4: BlockingQueue<any>, arg5: any, arg6: any);
    execute(arg0: any): void;
    shutdown(): void;
    shutdownNow(): any[];
    isShutdown(): boolean;
    isTerminating(): boolean;
    isTerminated(): boolean;
    awaitTermination(arg0: number, arg1: any): boolean;
    setThreadFactory(arg0: any): void;
    getThreadFactory(): any;
    setRejectedExecutionHandler(arg0: any): void;
    getRejectedExecutionHandler(): any;
    setCorePoolSize(arg0: number): void;
    getCorePoolSize(): number;
    prestartCoreThread(): boolean;
    prestartAllCoreThreads(): number;
    allowsCoreThreadTimeOut(): boolean;
    allowCoreThreadTimeOut(arg0: boolean): void;
    setMaximumPoolSize(arg0: number): void;
    getMaximumPoolSize(): number;
    setKeepAliveTime(arg0: number, arg1: any): void;
    getKeepAliveTime(arg0: any): number;
    getQueue(): BlockingQueue<any>;
    remove(arg0: any): boolean;
    purge(): void;
    getPoolSize(): number;
    getActiveCount(): number;
    getLargestPoolSize(): number;
    getTaskCount(): number;
    getCompletedTaskCount(): number;
    toString(): string;
  }
}

declare module "java:java.util.concurrent.TimeUnit" {
  export class TimeUnit<java.util.concurrent.TimeUnit> {
    convert(arg0: number, arg1: java.util.concurrent.TimeUnit): number;
    convert(arg0: any): number;
    toNanos(arg0: number): number;
    toMicros(arg0: number): number;
    toMillis(arg0: number): number;
    toSeconds(arg0: number): number;
    toMinutes(arg0: number): number;
    toHours(arg0: number): number;
    toDays(arg0: number): number;
    timedWait(arg0: any, arg1: number): void;
    timedJoin(arg0: any, arg1: number): void;
    sleep(arg0: number): void;
    toChronoUnit(): any;
    static values(): java.util.concurrent.TimeUnit[];
    static valueOf(arg0: string): java.util.concurrent.TimeUnit;
    static of(arg0: any): java.util.concurrent.TimeUnit;
    static NANOSECONDS: java.util.concurrent.TimeUnit;
    static MICROSECONDS: java.util.concurrent.TimeUnit;
    static MILLISECONDS: java.util.concurrent.TimeUnit;
    static SECONDS: java.util.concurrent.TimeUnit;
    static MINUTES: java.util.concurrent.TimeUnit;
    static HOURS: java.util.concurrent.TimeUnit;
    static DAYS: java.util.concurrent.TimeUnit;
  }
}

declare module "java:java.util.concurrent.TimeoutException" {
  export class TimeoutException {
    constructor();
    constructor(arg0: string);
  }
}

declare module "java:java.util.concurrent.TransferQueue" {
  export class TransferQueue<E> {
    tryTransfer(arg0: E): boolean;
    transfer(arg0: E): void;
    tryTransfer(arg0: E, arg1: number, arg2: any): boolean;
    hasWaitingConsumer(): boolean;
    getWaitingConsumerCount(): number;
  }
}

declare module "java:java.net.http.HttpRequest" {
  export class HttpRequest {
    bodyPublisher(): HttpRequestBodyPublisher | null;
    method(): string;
    timeout(): any | null;
    expectContinue(): boolean;
    uri(): any;
    version(): HttpClientVersion | null;
    headers(): any;
    equals(arg0: any): boolean;
    hashCode(): number;
    static newBuilder(arg0: any): HttpRequestBuilder;
    static newBuilder(arg0: any, arg1: BiPredicate<string, string>): HttpRequestBuilder;
    static newBuilder(): HttpRequestBuilder;
  }
}

declare module "java:java.net.http.HttpResponse" {
  export class HttpResponse<T> {
    statusCode(): number;
    connectionLabel(): string | null;
    request(): any;
    previousResponse(): HttpResponse<T> | null;
    headers(): any;
    body(): T;
    sslSession(): any | null;
    uri(): any;
    version(): HttpClientVersion;
  }
}

declare module "java:java.util.stream.AbstractPipeline" {
  export class AbstractPipeline<E_IN, E_OUT, S> {
    sequential(): S;
    parallel(): S;
    close(): void;
    onClose(arg0: any): S;
    spliterator(): Spliterator<E_OUT>;
    isParallel(): boolean;
  }
}

declare module "java:java.util.stream.AbstractShortCircuitTask" {
  export class AbstractShortCircuitTask<P_IN, P_OUT, R, K> {
    compute(): void;
    getRawResult(): R;
    getLocalResult(): R;
  }
}

declare module "java:java.util.stream.AbstractSpinedBuffer" {
  export class AbstractSpinedBuffer {
    isEmpty(): boolean;
    count(): number;
    clear(): void;
    static MIN_CHUNK_POWER: number;
    static MIN_CHUNK_SIZE: number;
    static MAX_CHUNK_POWER: number;
    static MIN_SPINE_SIZE: number;
  }
}

declare module "java:java.util.stream.AbstractTask" {
  export class AbstractTask<P_IN, P_OUT, R, K> {
    getRawResult(): R;
    compute(): void;
    onCompletion(arg0: CountedCompleter<any>): void;
    static getLeafTarget(): number;
    static suggestTargetSize(arg0: number): number;
  }
}

declare module "java:java.util.stream.BaseStream" {
  export class BaseStream<T, S> {
    iterator(): Iterable<T>;
    spliterator(): Spliterator<T>;
    isParallel(): boolean;
    sequential(): S;
    parallel(): S;
    unordered(): S;
    onClose(arg0: any): S;
    close(): void;
  }
}

declare module "java:java.util.stream.Collector" {
  export class Collector<T, A, R> {
    supplier(): () => A;
    accumulator(): (a: A, b: T) => void;
    combiner(): (a: A, b: any) => any;
    finisher(): (arg: A) => R;
    characteristics(): Set<CollectorCharacteristics>;
    static of<T, R>(arg0: () => R, arg1: (a: R, b: T) => void, arg2: (a: R, b: any) => any, arg3: CollectorCharacteristics[]): Collector<T, R, R>;
    static of<T, A, R>(arg0: () => A, arg1: (a: A, b: T) => void, arg2: (a: A, b: any) => any, arg3: (arg: A) => R, arg4: CollectorCharacteristics[]): Collector<T, A, R>;
  }
}

declare module "java:java.util.stream.Collectors" {
  export const Collectors: {
    toCollection(arg0: () => C): Collection<any>;
    toList<T>(): Collector<T, any, T[]>;
    toUnmodifiableList<T>(): Collector<T, any, T[]>;
    toSet<T>(): Collector<T, any, Set<T>>;
    toUnmodifiableSet<T>(): Collector<T, any, Set<T>>;
    joining(): Collector<any, any, string>;
    joining(arg0: any): Collector<any, any, string>;
    joining(arg0: any, arg1: any, arg2: any): Collector<any, any, string>;
    mapping<T, U, A, R>(arg0: (arg: any) => U, arg1: Collector<any, A, R>): Collector<T, any, R>;
    flatMapping<T, U, A, R>(arg0: (arg: any) => Stream<U>, arg1: Collector<any, A, R>): Collector<T, any, R>;
    filtering<T, A, R>(arg0: (value: any) => boolean, arg1: Collector<any, A, R>): Collector<T, any, R>;
    collectingAndThen<T, A, R, RR>(arg0: Collector<T, A, R>, arg1: (arg: R) => RR): Collector<T, A, RR>;
    counting<T>(): Collector<T, any, number>;
    minBy<T>(arg0: Comparator<any>): Collector<T, any, T | null>;
    maxBy<T>(arg0: Comparator<any>): Collector<T, any, T | null>;
    summingInt<T>(arg0: ToIntFunction<any>): Collector<T, any, number>;
    summingLong<T>(arg0: ToLongFunction<any>): Collector<T, any, number>;
    summingDouble<T>(arg0: ToDoubleFunction<any>): Collector<T, any, number>;
    averagingInt<T>(arg0: ToIntFunction<any>): Collector<T, any, number>;
    averagingLong<T>(arg0: ToLongFunction<any>): Collector<T, any, number>;
    averagingDouble<T>(arg0: ToDoubleFunction<any>): Collector<T, any, number>;
    reducing<T>(arg0: T, arg1: (a: T, b: any) => any): Collector<T, any, T>;
    reducing<T>(arg0: (a: T, b: any) => any): Collector<T, any, T | null>;
    reducing<T, U>(arg0: U, arg1: (arg: any) => U, arg2: (a: U, b: any) => any): Collector<T, any, U>;
    groupingBy<T, K>(arg0: (arg: any) => K): Collector<T, any, Map<K, T[]>>;
    groupingBy<T, K, A, D>(arg0: (arg: any) => K, arg1: Collector<any, A, D>): Collector<T, any, Map<K, D>>;
    groupingBy(arg0: (arg: any) => K, arg1: () => M, arg2: Collector<any, A, D>): Map<K, any>;
    groupingByConcurrent<T, K>(arg0: (arg: any) => K): Collector<T, any, ConcurrentMap<K, T[]>>;
    groupingByConcurrent<T, K, A, D>(arg0: (arg: any) => K, arg1: Collector<any, A, D>): Collector<T, any, ConcurrentMap<K, D>>;
    groupingByConcurrent(arg0: (arg: any) => K, arg1: () => M, arg2: Collector<any, A, D>): ConcurrentMap<K, any>;
    partitioningBy<T>(arg0: (value: any) => boolean): Collector<T, any, Map<boolean, T[]>>;
    partitioningBy<T, D, A>(arg0: (value: any) => boolean, arg1: Collector<any, A, D>): Collector<T, any, Map<boolean, D>>;
    toMap<T, K, U>(arg0: (arg: any) => K, arg1: (arg: any) => U): Collector<T, any, Map<K, U>>;
    toUnmodifiableMap<T, K, U>(arg0: (arg: any) => K, arg1: (arg: any) => U): Collector<T, any, Map<K, U>>;
    toMap<T, K, U>(arg0: (arg: any) => K, arg1: (arg: any) => U, arg2: (a: U, b: any) => any): Collector<T, any, Map<K, U>>;
    toUnmodifiableMap<T, K, U>(arg0: (arg: any) => K, arg1: (arg: any) => U, arg2: (a: U, b: any) => any): Collector<T, any, Map<K, U>>;
    toMap(arg0: (arg: any) => K, arg1: (arg: any) => U, arg2: (a: U, b: any) => any, arg3: () => M): Map<K, any>;
    toConcurrentMap<T, K, U>(arg0: (arg: any) => K, arg1: (arg: any) => U): Collector<T, any, ConcurrentMap<K, U>>;
    toConcurrentMap<T, K, U>(arg0: (arg: any) => K, arg1: (arg: any) => U, arg2: (a: U, b: any) => any): Collector<T, any, ConcurrentMap<K, U>>;
    toConcurrentMap(arg0: (arg: any) => K, arg1: (arg: any) => U, arg2: (a: U, b: any) => any, arg3: () => M): ConcurrentMap<K, any>;
    summarizingInt<T>(arg0: ToIntFunction<any>): Collector<T, any, any>;
    summarizingLong<T>(arg0: ToLongFunction<any>): Collector<T, any, any>;
    summarizingDouble<T>(arg0: ToDoubleFunction<any>): Collector<T, any, any>;
    teeing<T, R1, R2, R>(arg0: Collector<any, any, R1>, arg1: Collector<any, any, R2>, arg2: (a: any, b: any) => R): Collector<T, any, R>;
  };
}

declare module "java:java.util.stream.DistinctOps" {
  export const DistinctOps: {
  };
}

declare module "java:java.util.stream.DoublePipeline" {
  export class DoublePipeline<E_IN> {
    iterator(): PrimitiveIteratorOfDouble;
    spliterator(): SpliteratorOfDouble;
    boxed(): Stream<number>;
    map(arg0: any): any;
    mapToObj<U>(arg0: DoubleFunction<U>): Stream<U>;
    mapToInt(arg0: any): any;
    mapToLong(arg0: any): any;
    flatMap(arg0: DoubleFunction<any>): any;
    mapMulti(arg0: DoubleStreamDoubleMapMultiConsumer): any;
    unordered(): any;
    filter(arg0: any): any;
    peek(arg0: any): any;
    limit(arg0: number): any;
    skip(arg0: number): any;
    takeWhile(arg0: any): any;
    dropWhile(arg0: any): any;
    sorted(): any;
    distinct(): any;
    forEach(arg0: any): void;
    forEachOrdered(arg0: any): void;
    sum(): number;
    min(): any;
    max(): any;
    average(): any;
    count(): number;
    summaryStatistics(): any;
    reduce(arg0: number, arg1: any): number;
    reduce(arg0: any): any;
    collect<R>(arg0: () => R, arg1: ObjDoubleConsumer<R>, arg2: (a: R, b: R) => void): R;
    anyMatch(arg0: any): boolean;
    allMatch(arg0: any): boolean;
    noneMatch(arg0: any): boolean;
    findFirst(): any;
    findAny(): any;
    toArray(): number[];
    spliterator(): any;
    unordered(): any;
    iterator(): any;
    parallel(): any;
    sequential(): any;
  }
}

declare module "java:java.util.stream.DoubleStream" {
  export class DoubleStream<java.lang.Double, java.util.stream.DoubleStream> {
    filter(arg0: any): java.util.stream.DoubleStream;
    map(arg0: any): java.util.stream.DoubleStream;
    mapToObj<U>(arg0: DoubleFunction<U>): Stream<U>;
    mapToInt(arg0: any): any;
    mapToLong(arg0: any): any;
    flatMap(arg0: DoubleFunction<java.util.stream.DoubleStream>): java.util.stream.DoubleStream;
    mapMulti(arg0: DoubleStreamDoubleMapMultiConsumer): java.util.stream.DoubleStream;
    distinct(): java.util.stream.DoubleStream;
    sorted(): java.util.stream.DoubleStream;
    peek(arg0: any): java.util.stream.DoubleStream;
    limit(arg0: number): java.util.stream.DoubleStream;
    skip(arg0: number): java.util.stream.DoubleStream;
    takeWhile(arg0: any): java.util.stream.DoubleStream;
    dropWhile(arg0: any): java.util.stream.DoubleStream;
    forEach(arg0: any): void;
    forEachOrdered(arg0: any): void;
    toArray(): number[];
    reduce(arg0: number, arg1: any): number;
    reduce(arg0: any): any;
    collect<R>(arg0: () => R, arg1: ObjDoubleConsumer<R>, arg2: (a: R, b: R) => void): R;
    sum(): number;
    min(): any;
    max(): any;
    count(): number;
    average(): any;
    summaryStatistics(): any;
    anyMatch(arg0: any): boolean;
    allMatch(arg0: any): boolean;
    noneMatch(arg0: any): boolean;
    findFirst(): any;
    findAny(): any;
    boxed(): Stream<number>;
    sequential(): java.util.stream.DoubleStream;
    parallel(): java.util.stream.DoubleStream;
    iterator(): PrimitiveIteratorOfDouble;
    spliterator(): SpliteratorOfDouble;
    parallel(): any;
    sequential(): any;
    spliterator(): any;
    iterator(): any;
    static builder(): DoubleStreamBuilder;
    static empty(): java.util.stream.DoubleStream;
    static of(arg0: number): java.util.stream.DoubleStream;
    static of(arg0: number[]): java.util.stream.DoubleStream;
    static iterate(arg0: number, arg1: any): java.util.stream.DoubleStream;
    static iterate(arg0: number, arg1: any, arg2: any): java.util.stream.DoubleStream;
    static generate(arg0: any): java.util.stream.DoubleStream;
    static concat(arg0: java.util.stream.DoubleStream, arg1: java.util.stream.DoubleStream): java.util.stream.DoubleStream;
  }
}

declare module "java:java.util.stream.FindOps" {
  export const FindOps: {
    makeRef<T>(arg0: boolean): TerminalOp<T, T | null>;
    makeInt(arg0: boolean): TerminalOp<number, any>;
    makeLong(arg0: boolean): TerminalOp<number, any>;
    makeDouble(arg0: boolean): TerminalOp<number, any>;
  };
}

declare module "java:java.util.stream.ForEachOps" {
  export const ForEachOps: {
    makeRef<T>(arg0: (value: any) => void, arg1: boolean): TerminalOp<T, void>;
    makeInt(arg0: any, arg1: boolean): TerminalOp<number, void>;
    makeLong(arg0: any, arg1: boolean): TerminalOp<number, void>;
    makeDouble(arg0: any, arg1: boolean): TerminalOp<number, void>;
  };
}

declare module "java:java.util.stream.Gatherer" {
  export class Gatherer<T, A, R> {
    initializer(): () => A;
    integrator(): Gatherer$Integrator<A, T, R>;
    combiner(): (a: A, b: any) => any;
    finisher(): (a: A, b: Gatherer$Downstream<any>) => void;
    andThen<RR>(arg0: Gatherer<any, any, RR>): Gatherer<T, any, RR>;
    static defaultInitializer<A>(): () => A;
    static defaultCombiner<A>(): (a: A, b: any) => any;
    static defaultFinisher<A, R>(): (a: A, b: Gatherer$Downstream<any>) => void;
    static ofSequential<T, R>(arg0: Gatherer$Integrator<void, T, R>): Gatherer<T, void, R>;
    static ofSequential<T, R>(arg0: Gatherer$Integrator<void, T, R>, arg1: (a: void, b: Gatherer$Downstream<any>) => void): Gatherer<T, void, R>;
    static ofSequential<T, A, R>(arg0: () => A, arg1: Gatherer$Integrator<A, T, R>): Gatherer<T, A, R>;
    static ofSequential<T, A, R>(arg0: () => A, arg1: Gatherer$Integrator<A, T, R>, arg2: (a: A, b: Gatherer$Downstream<any>) => void): Gatherer<T, A, R>;
    static of<T, R>(arg0: Gatherer$Integrator<void, T, R>): Gatherer<T, void, R>;
    static of<T, R>(arg0: Gatherer$Integrator<void, T, R>, arg1: (a: void, b: Gatherer$Downstream<any>) => void): Gatherer<T, void, R>;
    static of<T, A, R>(arg0: () => A, arg1: Gatherer$Integrator<A, T, R>, arg2: (a: A, b: any) => any, arg3: (a: A, b: Gatherer$Downstream<any>) => void): Gatherer<T, A, R>;
  }
}

declare module "java:java.util.stream.GathererOp" {
  export class GathererOp<T, A, R> {
    collect<CR, CA>(arg0: Collector<any, CA, CR>): CR;
    collect<RR>(arg0: () => RR, arg1: (a: RR, b: any) => void, arg2: (a: RR, b: RR) => void): RR;
  }
}

declare module "java:java.util.stream.Gatherers" {
  export const Gatherers: {
    windowFixed<TR>(arg0: number): Gatherer<TR, any, TR[]>;
    windowSliding<TR>(arg0: number): Gatherer<TR, any, TR[]>;
    fold<T, R>(arg0: () => R, arg1: (a: any, b: any) => R): Gatherer<T, any, R>;
    scan<T, R>(arg0: () => R, arg1: (a: any, b: any) => R): Gatherer<T, any, R>;
    mapConcurrent<T, R>(arg0: number, arg1: (arg: any) => R): Gatherer<T, any, R>;
  };
}

declare module "java:java.util.stream.IntPipeline" {
  export class IntPipeline<E_IN> {
    iterator(): PrimitiveIteratorOfInt;
    spliterator(): SpliteratorOfInt;
    asLongStream(): any;
    asDoubleStream(): any;
    boxed(): Stream<number>;
    map(arg0: any): any;
    mapToObj<U>(arg0: IntFunction<U>): Stream<U>;
    mapToLong(arg0: any): any;
    mapToDouble(arg0: any): any;
    flatMap(arg0: IntFunction<any>): any;
    mapMulti(arg0: IntStreamIntMapMultiConsumer): any;
    unordered(): any;
    filter(arg0: any): any;
    peek(arg0: any): any;
    limit(arg0: number): any;
    skip(arg0: number): any;
    takeWhile(arg0: any): any;
    dropWhile(arg0: any): any;
    sorted(): any;
    distinct(): any;
    forEach(arg0: any): void;
    forEachOrdered(arg0: any): void;
    sum(): number;
    min(): any;
    max(): any;
    count(): number;
    average(): any;
    summaryStatistics(): any;
    reduce(arg0: number, arg1: any): number;
    reduce(arg0: any): any;
    collect<R>(arg0: () => R, arg1: ObjIntConsumer<R>, arg2: (a: R, b: R) => void): R;
    anyMatch(arg0: any): boolean;
    allMatch(arg0: any): boolean;
    noneMatch(arg0: any): boolean;
    findFirst(): any;
    findAny(): any;
    toArray(): number[];
    spliterator(): any;
    unordered(): any;
    iterator(): any;
    parallel(): any;
    sequential(): any;
  }
}

declare module "java:java.util.stream.IntStream" {
  export class IntStream<java.lang.Integer, java.util.stream.IntStream> {
    filter(arg0: any): java.util.stream.IntStream;
    map(arg0: any): java.util.stream.IntStream;
    mapToObj<U>(arg0: IntFunction<U>): Stream<U>;
    mapToLong(arg0: any): any;
    mapToDouble(arg0: any): any;
    flatMap(arg0: IntFunction<java.util.stream.IntStream>): java.util.stream.IntStream;
    mapMulti(arg0: IntStreamIntMapMultiConsumer): java.util.stream.IntStream;
    distinct(): java.util.stream.IntStream;
    sorted(): java.util.stream.IntStream;
    peek(arg0: any): java.util.stream.IntStream;
    limit(arg0: number): java.util.stream.IntStream;
    skip(arg0: number): java.util.stream.IntStream;
    takeWhile(arg0: any): java.util.stream.IntStream;
    dropWhile(arg0: any): java.util.stream.IntStream;
    forEach(arg0: any): void;
    forEachOrdered(arg0: any): void;
    toArray(): number[];
    reduce(arg0: number, arg1: any): number;
    reduce(arg0: any): any;
    collect<R>(arg0: () => R, arg1: ObjIntConsumer<R>, arg2: (a: R, b: R) => void): R;
    sum(): number;
    min(): any;
    max(): any;
    count(): number;
    average(): any;
    summaryStatistics(): any;
    anyMatch(arg0: any): boolean;
    allMatch(arg0: any): boolean;
    noneMatch(arg0: any): boolean;
    findFirst(): any;
    findAny(): any;
    asLongStream(): any;
    asDoubleStream(): any;
    boxed(): Stream<number>;
    sequential(): java.util.stream.IntStream;
    parallel(): java.util.stream.IntStream;
    iterator(): PrimitiveIteratorOfInt;
    spliterator(): SpliteratorOfInt;
    parallel(): any;
    sequential(): any;
    spliterator(): any;
    iterator(): any;
    static builder(): IntStreamBuilder;
    static empty(): java.util.stream.IntStream;
    static of(arg0: number): java.util.stream.IntStream;
    static of(arg0: number[]): java.util.stream.IntStream;
    static iterate(arg0: number, arg1: any): java.util.stream.IntStream;
    static iterate(arg0: number, arg1: any, arg2: any): java.util.stream.IntStream;
    static generate(arg0: any): java.util.stream.IntStream;
    static range(arg0: number, arg1: number): java.util.stream.IntStream;
    static rangeClosed(arg0: number, arg1: number): java.util.stream.IntStream;
    static concat(arg0: java.util.stream.IntStream, arg1: java.util.stream.IntStream): java.util.stream.IntStream;
  }
}

declare module "java:java.util.stream.LongPipeline" {
  export class LongPipeline<E_IN> {
    iterator(): PrimitiveIteratorOfLong;
    spliterator(): SpliteratorOfLong;
    asDoubleStream(): any;
    boxed(): Stream<number>;
    map(arg0: any): any;
    mapToObj<U>(arg0: LongFunction<U>): Stream<U>;
    mapToInt(arg0: any): any;
    mapToDouble(arg0: any): any;
    flatMap(arg0: LongFunction<any>): any;
    mapMulti(arg0: LongStreamLongMapMultiConsumer): any;
    unordered(): any;
    filter(arg0: any): any;
    peek(arg0: any): any;
    limit(arg0: number): any;
    skip(arg0: number): any;
    takeWhile(arg0: any): any;
    dropWhile(arg0: any): any;
    sorted(): any;
    distinct(): any;
    forEach(arg0: any): void;
    forEachOrdered(arg0: any): void;
    sum(): number;
    min(): any;
    max(): any;
    average(): any;
    count(): number;
    summaryStatistics(): any;
    reduce(arg0: number, arg1: any): number;
    reduce(arg0: any): any;
    collect<R>(arg0: () => R, arg1: ObjLongConsumer<R>, arg2: (a: R, b: R) => void): R;
    anyMatch(arg0: any): boolean;
    allMatch(arg0: any): boolean;
    noneMatch(arg0: any): boolean;
    findFirst(): any;
    findAny(): any;
    toArray(): number[];
    spliterator(): any;
    unordered(): any;
    iterator(): any;
    parallel(): any;
    sequential(): any;
  }
}

declare module "java:java.util.stream.LongStream" {
  export class LongStream<java.lang.Long, java.util.stream.LongStream> {
    filter(arg0: any): java.util.stream.LongStream;
    map(arg0: any): java.util.stream.LongStream;
    mapToObj<U>(arg0: LongFunction<U>): Stream<U>;
    mapToInt(arg0: any): any;
    mapToDouble(arg0: any): any;
    flatMap(arg0: LongFunction<java.util.stream.LongStream>): java.util.stream.LongStream;
    mapMulti(arg0: LongStreamLongMapMultiConsumer): java.util.stream.LongStream;
    distinct(): java.util.stream.LongStream;
    sorted(): java.util.stream.LongStream;
    peek(arg0: any): java.util.stream.LongStream;
    limit(arg0: number): java.util.stream.LongStream;
    skip(arg0: number): java.util.stream.LongStream;
    takeWhile(arg0: any): java.util.stream.LongStream;
    dropWhile(arg0: any): java.util.stream.LongStream;
    forEach(arg0: any): void;
    forEachOrdered(arg0: any): void;
    toArray(): number[];
    reduce(arg0: number, arg1: any): number;
    reduce(arg0: any): any;
    collect<R>(arg0: () => R, arg1: ObjLongConsumer<R>, arg2: (a: R, b: R) => void): R;
    sum(): number;
    min(): any;
    max(): any;
    count(): number;
    average(): any;
    summaryStatistics(): any;
    anyMatch(arg0: any): boolean;
    allMatch(arg0: any): boolean;
    noneMatch(arg0: any): boolean;
    findFirst(): any;
    findAny(): any;
    asDoubleStream(): any;
    boxed(): Stream<number>;
    sequential(): java.util.stream.LongStream;
    parallel(): java.util.stream.LongStream;
    iterator(): PrimitiveIteratorOfLong;
    spliterator(): SpliteratorOfLong;
    parallel(): any;
    sequential(): any;
    spliterator(): any;
    iterator(): any;
    static builder(): LongStreamBuilder;
    static empty(): java.util.stream.LongStream;
    static of(arg0: number): java.util.stream.LongStream;
    static of(arg0: number[]): java.util.stream.LongStream;
    static iterate(arg0: number, arg1: any): java.util.stream.LongStream;
    static iterate(arg0: number, arg1: any, arg2: any): java.util.stream.LongStream;
    static generate(arg0: any): java.util.stream.LongStream;
    static range(arg0: number, arg1: number): java.util.stream.LongStream;
    static rangeClosed(arg0: number, arg1: number): java.util.stream.LongStream;
    static concat(arg0: java.util.stream.LongStream, arg1: java.util.stream.LongStream): java.util.stream.LongStream;
  }
}

declare module "java:java.util.stream.MatchOps" {
  export const MatchOps: {
    makeRef<T>(arg0: (value: any) => boolean, arg1: MatchOpsMatchKind): TerminalOp<T, boolean>;
    makeInt(arg0: any, arg1: MatchOpsMatchKind): TerminalOp<number, boolean>;
    makeLong(arg0: any, arg1: MatchOpsMatchKind): TerminalOp<number, boolean>;
    makeDouble(arg0: any, arg1: MatchOpsMatchKind): TerminalOp<number, boolean>;
  };
}

declare module "java:java.util.stream.Node" {
  export class Node<T> {
    spliterator(): Spliterator<T>;
    forEach(arg0: (value: any) => void): void;
    getChildCount(): number;
    getChild(arg0: number): Node<T>;
    truncate(arg0: number, arg1: number, arg2: IntFunction<T[]>): Node<T>;
    asArray(arg0: IntFunction<T[]>): T[];
    copyInto(arg0: T[], arg1: number): void;
    getShape(): any;
    count(): number;
  }
}

declare module "java:java.util.stream.Nodes" {
  export const Nodes: {
    collect<P_IN, P_OUT>(arg0: PipelineHelper<P_OUT>, arg1: Spliterator<P_IN>, arg2: boolean, arg3: IntFunction<P_OUT[]>): Node<P_OUT>;
    collectInt<P_IN>(arg0: PipelineHelper<number>, arg1: Spliterator<P_IN>, arg2: boolean): NodeOfInt;
    collectLong<P_IN>(arg0: PipelineHelper<number>, arg1: Spliterator<P_IN>, arg2: boolean): NodeOfLong;
    collectDouble<P_IN>(arg0: PipelineHelper<number>, arg1: Spliterator<P_IN>, arg2: boolean): NodeOfDouble;
    flatten<T>(arg0: Node<T>, arg1: IntFunction<T[]>): Node<T>;
    flattenInt(arg0: NodeOfInt): NodeOfInt;
    flattenLong(arg0: NodeOfLong): NodeOfLong;
    flattenDouble(arg0: NodeOfDouble): NodeOfDouble;
  };
}

declare module "java:java.util.stream.PipelineHelper" {
  export const PipelineHelper: {
  };
}

declare module "java:java.util.stream.ReduceOps" {
  export const ReduceOps: {
    makeRef<T, U>(arg0: U, arg1: (a: U, b: any) => U, arg2: (a: U, b: any) => any): TerminalOp<T, U>;
    makeRef<T>(arg0: (a: T, b: any) => any): TerminalOp<T, T | null>;
    makeRef<T, I>(arg0: Collector<any, I, any>): TerminalOp<T, I>;
    makeRef<T, R>(arg0: () => R, arg1: (a: R, b: any) => void, arg2: (a: R, b: R) => void): TerminalOp<T, R>;
    makeRefCounting<T>(): TerminalOp<T, number>;
    makeInt(arg0: number, arg1: any): TerminalOp<number, number>;
    makeInt(arg0: any): TerminalOp<number, any>;
    makeInt<R>(arg0: () => R, arg1: ObjIntConsumer<R>, arg2: (a: R, b: any) => any): TerminalOp<number, R>;
    makeIntCounting(): TerminalOp<number, number>;
    makeLong(arg0: number, arg1: any): TerminalOp<number, number>;
    makeLong(arg0: any): TerminalOp<number, any>;
    makeLong<R>(arg0: () => R, arg1: ObjLongConsumer<R>, arg2: (a: R, b: any) => any): TerminalOp<number, R>;
    makeLongCounting(): TerminalOp<number, number>;
    makeDouble(arg0: number, arg1: any): TerminalOp<number, number>;
    makeDouble(arg0: any): TerminalOp<number, any>;
    makeDouble<R>(arg0: () => R, arg1: ObjDoubleConsumer<R>, arg2: (a: R, b: any) => any): TerminalOp<number, R>;
    makeDoubleCounting(): TerminalOp<number, number>;
  };
}

declare module "java:java.util.stream.ReferencePipeline" {
  export class ReferencePipeline<P_IN, P_OUT> {
    iterator(): Iterable<P_OUT>;
    unordered(): Stream<P_OUT>;
    filter(arg0: (value: any) => boolean): Stream<P_OUT>;
    map<R>(arg0: (arg: any) => R): Stream<R>;
    mapToInt(arg0: ToIntFunction<any>): any;
    mapToLong(arg0: ToLongFunction<any>): any;
    mapToDouble(arg0: ToDoubleFunction<any>): any;
    flatMap<R>(arg0: (arg: any) => Stream<R>): Stream<R>;
    flatMapToInt(arg0: (arg: any) => any): any;
    flatMapToDouble(arg0: (arg: any) => any): any;
    flatMapToLong(arg0: (arg: any) => any): any;
    mapMulti<R>(arg0: (a: any, b: Consumer<R>) => void): Stream<R>;
    mapMultiToInt(arg0: (a: any, b: any) => void): any;
    mapMultiToLong(arg0: (a: any, b: any) => void): any;
    mapMultiToDouble(arg0: (a: any, b: any) => void): any;
    peek(arg0: (value: any) => void): Stream<P_OUT>;
    distinct(): Stream<P_OUT>;
    sorted(): Stream<P_OUT>;
    sorted(arg0: Comparator<any>): Stream<P_OUT>;
    limit(arg0: number): Stream<P_OUT>;
    skip(arg0: number): Stream<P_OUT>;
    takeWhile(arg0: (value: any) => boolean): Stream<P_OUT>;
    dropWhile(arg0: (value: any) => boolean): Stream<P_OUT>;
    forEach(arg0: (value: any) => void): void;
    forEachOrdered(arg0: (value: any) => void): void;
    toArray<A>(arg0: IntFunction<A[]>): A[];
    toArray(): any[];
    toList(): P_OUT[];
    anyMatch(arg0: (value: any) => boolean): boolean;
    allMatch(arg0: (value: any) => boolean): boolean;
    noneMatch(arg0: (value: any) => boolean): boolean;
    findFirst(): P_OUT | null;
    findAny(): P_OUT | null;
    reduce(arg0: P_OUT, arg1: (a: P_OUT, b: any) => any): P_OUT;
    reduce(arg0: (a: P_OUT, b: any) => any): P_OUT | null;
    reduce<R>(arg0: R, arg1: (a: R, b: any) => R, arg2: (a: R, b: any) => any): R;
    gather<R>(arg0: Gatherer<any, any, R>): Stream<R>;
    collect<R, A>(arg0: Collector<any, A, R>): R;
    collect<R>(arg0: () => R, arg1: (a: R, b: any) => void, arg2: (a: R, b: R) => void): R;
    max(arg0: Comparator<any>): P_OUT | null;
    min(arg0: Comparator<any>): P_OUT | null;
    count(): number;
    unordered(): any;
  }
}

declare module "java:java.util.stream.Sink" {
  export class Sink<T> {
    begin(arg0: number): void;
    end(): void;
    cancellationRequested(): boolean;
    accept(arg0: number): void;
    accept(arg0: number): void;
    accept(arg0: number): void;
  }
}

declare module "java:java.util.stream.SliceOps" {
  export const SliceOps: {
    makeRef<T>(arg0: AbstractPipeline<any, T, any>, arg1: number, arg2: number): Stream<T>;
    makeInt(arg0: AbstractPipeline<any, number, any>, arg1: number, arg2: number): any;
    makeLong(arg0: AbstractPipeline<any, number, any>, arg1: number, arg2: number): any;
    makeDouble(arg0: AbstractPipeline<any, number, any>, arg1: number, arg2: number): any;
  };
}

declare module "java:java.util.stream.SortedOps" {
  export const SortedOps: {
  };
}

declare module "java:java.util.stream.SpinedBuffer" {
  export class SpinedBuffer<E> {
    get(arg0: number): E;
    copyInto(arg0: E[], arg1: number): void;
    asArray(arg0: IntFunction<E[]>): E[];
    clear(): void;
    iterator(): Iterable<E>;
    forEach(arg0: (value: any) => void): void;
    accept(arg0: E): void;
    toString(): string;
    spliterator(): Spliterator<E>;
  }
}

declare module "java:java.util.stream.Stream" {
  export class Stream<T> {
    filter(arg0: (value: any) => boolean): Stream<T>;
    map<R>(arg0: (arg: any) => R): Stream<R>;
    mapToInt(arg0: ToIntFunction<any>): any;
    mapToLong(arg0: ToLongFunction<any>): any;
    mapToDouble(arg0: ToDoubleFunction<any>): any;
    flatMap<R>(arg0: (arg: any) => Stream<R>): Stream<R>;
    flatMapToInt(arg0: (arg: any) => any): any;
    flatMapToLong(arg0: (arg: any) => any): any;
    flatMapToDouble(arg0: (arg: any) => any): any;
    mapMulti<R>(arg0: (a: any, b: Consumer<R>) => void): Stream<R>;
    mapMultiToInt(arg0: (a: any, b: any) => void): any;
    mapMultiToLong(arg0: (a: any, b: any) => void): any;
    mapMultiToDouble(arg0: (a: any, b: any) => void): any;
    distinct(): Stream<T>;
    sorted(): Stream<T>;
    sorted(arg0: Comparator<any>): Stream<T>;
    peek(arg0: (value: any) => void): Stream<T>;
    limit(arg0: number): Stream<T>;
    skip(arg0: number): Stream<T>;
    takeWhile(arg0: (value: any) => boolean): Stream<T>;
    dropWhile(arg0: (value: any) => boolean): Stream<T>;
    forEach(arg0: (value: any) => void): void;
    forEachOrdered(arg0: (value: any) => void): void;
    toArray(): any[];
    toArray<A>(arg0: IntFunction<A[]>): A[];
    reduce(arg0: T, arg1: (a: T, b: any) => any): T;
    reduce(arg0: (a: T, b: any) => any): T | null;
    reduce<U>(arg0: U, arg1: (a: U, b: any) => U, arg2: (a: U, b: any) => any): U;
    gather<R>(arg0: Gatherer<any, any, R>): Stream<R>;
    collect<R>(arg0: () => R, arg1: (a: R, b: any) => void, arg2: (a: R, b: R) => void): R;
    collect<R, A>(arg0: Collector<any, A, R>): R;
    toList(): T[];
    min(arg0: Comparator<any>): T | null;
    max(arg0: Comparator<any>): T | null;
    count(): number;
    anyMatch(arg0: (value: any) => boolean): boolean;
    allMatch(arg0: (value: any) => boolean): boolean;
    noneMatch(arg0: (value: any) => boolean): boolean;
    findFirst(): T | null;
    findAny(): T | null;
    static builder<T>(): Stream$Builder<T>;
    static empty<T>(): Stream<T>;
    static of<T>(arg0: T): Stream<T>;
    static ofNullable<T>(arg0: T): Stream<T>;
    static of<T>(arg0: T[]): Stream<T>;
    static iterate<T>(arg0: T, arg1: (arg: T) => any): Stream<T>;
    static iterate<T>(arg0: T, arg1: (value: any) => boolean, arg2: (arg: T) => any): Stream<T>;
    static generate<T>(arg0: () => T): Stream<T>;
    static concat<T>(arg0: Stream<T>, arg1: Stream<T>): Stream<T>;
  }
}

declare module "java:java.util.stream.StreamOpFlag" {
  export const StreamOpFlag: {
    readonly DISTINCT: java.util.stream.StreamOpFlag;
    readonly SORTED: java.util.stream.StreamOpFlag;
    readonly ORDERED: java.util.stream.StreamOpFlag;
    readonly SIZED: java.util.stream.StreamOpFlag;
    readonly SHORT_CIRCUIT: java.util.stream.StreamOpFlag;
    readonly SIZE_ADJUSTING: java.util.stream.StreamOpFlag;
    values(): java.util.stream.StreamOpFlag[];
    valueOf(arg0: string): java.util.stream.StreamOpFlag;
  };
}

declare module "java:java.util.stream.StreamShape" {
  export const StreamShape: {
    readonly REFERENCE: java.util.stream.StreamShape;
    readonly INT_VALUE: java.util.stream.StreamShape;
    readonly LONG_VALUE: java.util.stream.StreamShape;
    readonly DOUBLE_VALUE: java.util.stream.StreamShape;
    values(): java.util.stream.StreamShape[];
    valueOf(arg0: string): java.util.stream.StreamShape;
  };
}

declare module "java:java.util.stream.StreamSpliterators" {
  export const StreamSpliterators: {
  };
}

declare module "java:java.util.stream.StreamSupport" {
  export const StreamSupport: {
    stream<T>(arg0: Spliterator<T>, arg1: boolean): Stream<T>;
    stream<T>(arg0: () => Spliterator<T>, arg1: number, arg2: boolean): Stream<T>;
    intStream(arg0: SpliteratorOfInt, arg1: boolean): any;
    intStream(arg0: () => SpliteratorOfInt, arg1: number, arg2: boolean): any;
    longStream(arg0: SpliteratorOfLong, arg1: boolean): any;
    longStream(arg0: () => SpliteratorOfLong, arg1: number, arg2: boolean): any;
    doubleStream(arg0: SpliteratorOfDouble, arg1: boolean): any;
    doubleStream(arg0: () => SpliteratorOfDouble, arg1: number, arg2: boolean): any;
  };
}

declare module "java:java.util.stream.Streams" {
  export const Streams: {
  };
}

declare module "java:java.util.stream.TerminalOp" {
  export class TerminalOp<E_IN, R> {
    inputShape(): any;
    getOpFlags(): number;
    evaluateParallel<P_IN>(arg0: PipelineHelper<E_IN>, arg1: Spliterator<P_IN>): R;
    evaluateSequential<P_IN>(arg0: PipelineHelper<E_IN>, arg1: Spliterator<P_IN>): R;
  }
}

declare module "java:java.util.stream.TerminalSink" {
  export const TerminalSink: {
  };
}

declare module "java:java.util.stream.Tripwire" {
  export const Tripwire: {
  };
}

declare module "java:java.util.stream.WhileOps" {
  export const WhileOps: {
  };
}

declare module "java:org.springaicommunity.claude.agent.sdk.DefaultClaudeAsyncClient" {
  export class DefaultClaudeAsyncClient {
    constructor(arg0: any, arg1: CLIOptions, arg2: any, arg3: string, arg4: HookRegistry);
    connect(): Mono<void>;
    connect(arg0: string): TurnSpec;
    query(arg0: string): TurnSpec;
    receiveMessages(): Flux<ParsedMessage>;
    receiveResponse(): Flux<Message>;
    interrupt(): Mono<void>;
    setPermissionMode(arg0: string): Mono<void>;
    setModel(arg0: string): Mono<void>;
    getServerInfo(): Map<string, any> | null;
    setToolPermissionCallback(arg0: ToolPermissionCallback): void;
    getToolPermissionCallback(): ToolPermissionCallback;
    isConnected(): boolean;
    close(): Mono<void>;
    onMessage(arg0: (value: Message) => void): ClaudeAsyncClient;
    onResult(arg0: (value: ResultMessage) => void): ClaudeAsyncClient;
    registerHook(arg0: HookEvent, arg1: string, arg2: HookCallback): DefaultClaudeAsyncClient;
    getCurrentSessionId(): string;
    getCurrentModel(): string;
    getCurrentPermissionMode(): string;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.mcp.McpServerConfig" {
  export class McpServerConfig {
    type(): string;
    isSdkServer(): boolean;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.mcp.McpMessageHandler" {
  export class McpMessageHandler {
    constructor();
    constructor(arg0: any);
    registerServer(arg0: string, arg1: any): void;
    unregisterServer(arg0: string): void;
    hasServer(arg0: string): boolean;
    handleMcpMessage(arg0: string, arg1: Map<string, any>): Map<string, any>;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.mcp.McpToolNaming" {
  export const McpToolNaming: {
    formatToolName(arg0: string, arg1: string): string;
    parseToolName(arg0: string): string[];
    isMcpToolName(arg0: string): boolean;
    extractServerName(arg0: string): string;
    extractToolName(arg0: string): string;
  };
}

declare module "java:org.springaicommunity.claude.agent.sdk.resilience.CircuitBreaker" {
  export class CircuitBreaker {
    constructor(arg0: string, arg1: number, arg2: any, arg3: any);
    execute<T>(arg0: () => T): T;
    getState(): State;
    getMetrics(): CircuitBreakerMetrics;
    reset(): void;
    static defaultClaudeBreaker(): CircuitBreaker;
    static sensitive(arg0: string): CircuitBreaker;
    static tolerant(arg0: string): CircuitBreaker;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.resilience.RetryConfiguration" {
  export class RetryConfiguration {
    constructor(arg0: number, arg1: any, arg2: number, arg3: any, arg4: (value: any) => boolean);
    calculateDelay(arg0: number): any;
    shouldRetry(arg0: any, arg1: number): boolean;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    maxAttempts(): number;
    initialDelay(): any;
    backoffMultiplier(): number;
    maxDelay(): any;
    retryablePredicate(): (value: any) => boolean;
    static defaultNetwork(): RetryConfiguration;
    static aggressive(): RetryConfiguration;
    static conservative(): RetryConfiguration;
    static noRetry(): RetryConfiguration;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.resilience.ResilienceManager" {
  export class ResilienceManager {
    constructor();
    constructor(arg0: RetryConfiguration, arg1: any);
    executeResilient<T>(arg0: string, arg1: () => T): T;
    executeResilient<T>(arg0: string, arg1: () => T, arg2: RetryConfiguration): T;
    executeResilientMono<T>(arg0: string, arg1: () => Mono<T>): Mono<T>;
    executeResilientMono<T>(arg0: string, arg1: () => Mono<T>, arg2: RetryConfiguration): Mono<T>;
    executeResilientFlux<T>(arg0: string, arg1: () => Flux<T>): Flux<T>;
    executeResilientFlux<T>(arg0: string, arg1: () => Flux<T>, arg2: RetryConfiguration): Flux<T>;
    getCircuitBreakerMetrics(arg0: string): CircuitBreakerMetrics;
    getAllMetrics(): ConcurrentMap<string, CircuitBreakerMetrics>;
    resetCircuitBreaker(arg0: string): void;
    resetAllCircuitBreakers(): void;
    createCircuitBreaker(arg0: string, arg1: number, arg2: any, arg3: any): CircuitBreaker;
    static builder(): Builder;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.Query" {
  export class Query {
    constructor();
    static text(arg0: string): string;
    static text(arg0: string, arg1: QueryOptions): string;
    static query(arg0: string): Iterable<Message>;
    static query(arg0: string, arg1: QueryOptions): Iterable<Message>;
    static stream(arg0: string): Stream<Message>;
    static stream(arg0: string, arg1: QueryOptions): Stream<Message>;
    static execute(arg0: string): QueryResult;
    static execute(arg0: string, arg1: QueryOptions): QueryResult;
    static execute(arg0: string, arg1: CLIOptions): QueryResult;
    static execute(arg0: string, arg1: CLIOptions, arg2: any): QueryResult;
    static isCliInstalled(): boolean;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.DefaultClaudeSyncClient" {
  export class DefaultClaudeSyncClient {
    constructor(arg0: any, arg1: CLIOptions, arg2: any, arg3: string, arg4: HookRegistry);
    connect(): void;
    connect(arg0: string): void;
    query(arg0: string): void;
    query(arg0: string, arg1: string): void;
    receiveMessages(): Iterable<ParsedMessage>;
    receiveResponse(): Iterable<ParsedMessage>;
    messages(): Iterable<Message>;
    connectAndReceive(arg0: string): Iterable<Message>;
    queryAndReceive(arg0: string): Iterable<Message>;
    connectText(arg0: string): string;
    queryText(arg0: string): string;
    messageReceiver(): MessageReceiver;
    responseReceiver(): MessageReceiver;
    interrupt(): void;
    setPermissionMode(arg0: string): void;
    setModel(arg0: string): void;
    getCurrentModel(): string;
    getCurrentPermissionMode(): string;
    setToolPermissionCallback(arg0: ToolPermissionCallback): void;
    getToolPermissionCallback(): ToolPermissionCallback;
    getServerInfo(): Map<string, any>;
    isConnected(): boolean;
    disconnect(): void;
    close(): void;
    registerHook(arg0: HookEvent, arg1: string, arg2: HookCallback): DefaultClaudeSyncClient;
    getCurrentSessionId(): string;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.config.PluginConfig" {
  export class PluginConfig {
    constructor(arg0: string, arg1: any);
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    type(): string;
    path(): any;
    static local(arg0: any): PluginConfig;
    static local(arg0: string): PluginConfig;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.config.SDKConfiguration" {
  export class SDKConfiguration {
    constructor(arg0: string, arg1: string, arg2: string, arg3: number, arg4: number, arg5: any, arg6: any, arg7: string[], arg8: string[], arg9: PermissionMode, arg10: boolean, arg11: string, arg12: number, arg13: Map<string, any>);
    toCliOptions(): CLIOptions;
    getTimeout(): any;
    getWorkingDirectory(): any;
    getModel(): string;
    getSystemPrompt(): string;
    getMaxTokens(): number;
    getMaxThinkingTokens(): number;
    getAllowedTools(): string[];
    getDisallowedTools(): string[];
    getPermissionMode(): PermissionMode;
    isContinueConversation(): boolean;
    getResumeFromSession(): string;
    getMaxTurns(): number;
    getAdditionalSettings(): Map<string, any>;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    model(): string;
    systemPrompt(): string;
    appendSystemPrompt(): string;
    maxTokens(): number;
    maxThinkingTokens(): number;
    timeout(): any;
    workingDirectory(): any;
    allowedTools(): string[];
    disallowedTools(): string[];
    permissionMode(): PermissionMode;
    continueConversation(): boolean;
    resumeFromSession(): string;
    maxTurns(): number;
    additionalSettings(): Map<string, any>;
    static builder(): Builder;
    static defaultConfiguration(): SDKConfiguration;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.config.OutputFormat" {
  export class OutputFormat<org.springaicommunity.claude.agent.sdk.config.OutputFormat> {
    getValue(): string;
    static values(): org.springaicommunity.claude.agent.sdk.config.OutputFormat[];
    static valueOf(arg0: string): org.springaicommunity.claude.agent.sdk.config.OutputFormat;
    static fromValue(arg0: string): org.springaicommunity.claude.agent.sdk.config.OutputFormat;
    static TEXT: org.springaicommunity.claude.agent.sdk.config.OutputFormat;
    static JSON: org.springaicommunity.claude.agent.sdk.config.OutputFormat;
    static STREAM_JSON: org.springaicommunity.claude.agent.sdk.config.OutputFormat;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.config.PermissionMode" {
  export class PermissionMode<org.springaicommunity.claude.agent.sdk.config.PermissionMode> {
    getValue(): string;
    toString(): string;
    static values(): org.springaicommunity.claude.agent.sdk.config.PermissionMode[];
    static valueOf(arg0: string): org.springaicommunity.claude.agent.sdk.config.PermissionMode;
    static fromValue(arg0: string): org.springaicommunity.claude.agent.sdk.config.PermissionMode;
    static DEFAULT: org.springaicommunity.claude.agent.sdk.config.PermissionMode;
    static ACCEPT_EDITS: org.springaicommunity.claude.agent.sdk.config.PermissionMode;
    static BYPASS_PERMISSIONS: org.springaicommunity.claude.agent.sdk.config.PermissionMode;
    static DANGEROUSLY_SKIP_PERMISSIONS: org.springaicommunity.claude.agent.sdk.config.PermissionMode;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.config.ClaudeCliDiscovery" {
  export class ClaudeCliDiscovery {
    constructor();
    static discoverClaudePath(): string;
    static getDiscoveredPath(): string;
    static isClaudeCliAvailable(): boolean;
    static forceRediscovery(): void;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.QueryOptions" {
  export class QueryOptions {
    constructor(arg0: string, arg1: string, arg2: string, arg3: any, arg4: string[], arg5: string[], arg6: number, arg7: number, arg8: any, arg9: number, arg10: number, arg11: string, arg12: Map<string, any>);
    toCLIOptions(): CLIOptions;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    model(): string;
    systemPrompt(): string;
    appendSystemPrompt(): string;
    timeout(): any;
    allowedTools(): string[];
    disallowedTools(): string[];
    maxTurns(): number;
    maxBudgetUsd(): number;
    workingDirectory(): any;
    maxTokens(): number;
    maxThinkingTokens(): number;
    fallbackModel(): string;
    jsonSchema(): Map<string, any>;
    static defaults(): QueryOptions;
    static builder(): Builder;
    static DEFAULT_TIMEOUT: any;
    static DEFAULT_WORKING_DIRECTORY: any;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.transport.CLIOptions" {
  export class CLIOptions {
    constructor(arg0: string, arg1: string, arg2: number, arg3: number, arg4: any, arg5: string[], arg6: string[], arg7: string[], arg8: PermissionMode, arg9: boolean, arg10: OutputFormat, arg11: string[], arg12: string, arg13: boolean, arg14: boolean, arg15: Map<string, any>, arg16: Map<string, McpServerConfig>, arg17: number, arg18: number, arg19: string, arg20: string, arg21: boolean, arg22: string, arg23: any[], arg24: string, arg25: string, arg26: Map<string, string>, arg27: PluginConfig[], arg28: Map<string, string>, arg29: number, arg30: string, arg31: StderrHandler, arg32: ToolPermissionCallback);
    getTimeout(): any;
    getModel(): string;
    getSystemPrompt(): string;
    getMaxTokens(): number;
    getMaxThinkingTokens(): number;
    getTools(): string[];
    getAllowedTools(): string[];
    getDisallowedTools(): string[];
    getPermissionMode(): PermissionMode;
    isInteractive(): boolean;
    getOutputFormat(): OutputFormat;
    getSettingSources(): string[];
    getAgents(): string;
    isForkSession(): boolean;
    isIncludePartialMessages(): boolean;
    getJsonSchema(): Map<string, any>;
    getMcpServers(): Map<string, McpServerConfig>;
    getMaxTurns(): number;
    getMaxBudgetUsd(): number;
    getFallbackModel(): string;
    getAppendSystemPrompt(): string;
    isContinueConversation(): boolean;
    getResume(): string;
    getAddDirs(): any[];
    getSettings(): string;
    getPermissionPromptToolName(): string;
    getExtraArgs(): Map<string, string>;
    getPlugins(): PluginConfig[];
    getEnv(): Map<string, string>;
    getMaxBufferSize(): number;
    getEffectiveMaxBufferSize(): number;
    getUser(): string;
    getStderrHandler(): StderrHandler;
    getToolPermissionCallback(): ToolPermissionCallback;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    model(): string;
    systemPrompt(): string;
    maxTokens(): number;
    maxThinkingTokens(): number;
    timeout(): any;
    tools(): string[];
    allowedTools(): string[];
    disallowedTools(): string[];
    permissionMode(): PermissionMode;
    interactive(): boolean;
    outputFormat(): OutputFormat;
    settingSources(): string[];
    agents(): string;
    forkSession(): boolean;
    includePartialMessages(): boolean;
    jsonSchema(): Map<string, any>;
    mcpServers(): Map<string, McpServerConfig>;
    maxTurns(): number;
    maxBudgetUsd(): number;
    fallbackModel(): string;
    appendSystemPrompt(): string;
    continueConversation(): boolean;
    resume(): string;
    addDirs(): any[];
    settings(): string;
    permissionPromptToolName(): string;
    extraArgs(): Map<string, string>;
    plugins(): PluginConfig[];
    env(): Map<string, string>;
    maxBufferSize(): number;
    user(): string;
    stderrHandler(): StderrHandler;
    toolPermissionCallback(): ToolPermissionCallback;
    static builder(): Builder;
    static defaultOptions(): CLIOptions;
    static DEFAULT_MAX_BUFFER_SIZE: number;
    static MODEL_HAIKU: string;
    static MODEL_SONNET: string;
    static MODEL_OPUS: string;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.transport.ToolPermissionCallback" {
  export class ToolPermissionCallback {
    canUseTool(arg0: string, arg1: Map<string, any>, arg2: ToolPermissionContext): Promise<ToolPermissionResult>;
    static allowAll(): ToolPermissionCallback;
    static allowList(arg0: Set<string>): ToolPermissionCallback;
    static denyList(arg0: Set<string>): ToolPermissionCallback;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.transport.StderrHandler" {
  export class StderrHandler {
    handle(arg0: string): void;
    andThen(arg0: StderrHandler): StderrHandler;
    static logging(arg0: any): StderrHandler;
    static loggingInfo(arg0: any): StderrHandler;
    static noop(): StderrHandler;
    static systemErr(): StderrHandler;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.transport.StreamingTransport" {
  export class StreamingTransport {
    constructor(arg0: any);
    constructor(arg0: any, arg1: any);
    constructor(arg0: any, arg1: any, arg2: string);
    getState(): number;
    getStateName(): string;
    startSession(arg0: string, arg1: CLIOptions, arg2: (value: ParsedMessage) => void, arg3: ControlRequestHandler): void;
    startSession(arg0: string, arg1: CLIOptions, arg2: (value: ParsedMessage) => void, arg3: ControlRequestHandler, arg4: (value: ControlResponse) => void): void;
    sendUserMessage(arg0: string, arg1: string): void;
    sendResponse(arg0: ControlResponse): void;
    sendMessage(arg0: string): void;
    receiveMessages(): Flux<ParsedMessage>;
    getInboundFlux(): Flux<ParsedMessage>;
    getServerInfo(): Mono<Map<string, any>>;
    messageIterator(): Iterable<ParsedMessage>;
    messageIterable(): Iterable<ParsedMessage>;
    waitForCompletion(arg0: any): boolean;
    isRunning(): boolean;
    getSessionError(): any;
    getSessionId(): string;
    interrupt(): void;
    closeGracefully(): Mono<void>;
    close(): void;
    getToolPermissionCallback(): ToolPermissionCallback;
    handleCanUseTool(arg0: string, arg1: CanUseToolRequest): ControlResponse;
    static STATE_DISCONNECTED: number;
    static STATE_CONNECTING: number;
    static STATE_CONNECTED: number;
    static STATE_CLOSING: number;
    static STATE_CLOSED: number;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.ClaudeClient" {
  export const ClaudeClient: {
    sync(): SyncSpec;
    sync(arg0: CLIOptions): SyncSpecWithOptions;
    async(): AsyncSpec;
    async(arg0: CLIOptions): AsyncSpecWithOptions;
  };
}

declare module "java:org.springaicommunity.claude.agent.sdk.ClaudeCliPrototype" {
  export class ClaudeCliPrototype {
    constructor(arg0: any);
    constructor(arg0: any, arg1: string);
    testBasicExecution(): void;
    testStreamingOutput(arg0: string): void;
    testRealTimeStreaming(arg0: string): void;
    static main(arg0: string[]): void;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.streaming.BlockingMessageReceiver" {
  export class BlockingMessageReceiver {
    constructor();
    constructor(arg0: number);
    offer(arg0: ParsedMessage): boolean;
    complete(): void;
    completeWithError(arg0: any): void;
    next(): ParsedMessage;
    close(): void;
    isActive(): boolean;
    getBufferedCount(): number;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.streaming.ResponseBoundedReceiver" {
  export class ResponseBoundedReceiver {
    constructor(arg0: BlockingMessageReceiver);
    next(): ParsedMessage;
    close(): void;
    isResultReceived(): boolean;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.streaming.MessageReceiver" {
  export class MessageReceiver {
    next(): ParsedMessage;
    close(): void;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.streaming.RobustStreamingProcessor" {
  export class RobustStreamingProcessor {
    constructor(arg0: (value: Message) => void, arg1: OutputFormat);
    close(): void;
    getStatistics(): StreamingStatistics;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.streaming.StreamingStateMachine" {
  export class StreamingStateMachine {
    constructor();
    processMessage(arg0: Message): void;
    isComplete(): boolean;
    isError(): boolean;
    getCurrentState(): State;
    getReceivedMessages(): Message[];
    getStats(): StreamingStats;
    validateCompletion(): StreamCompletionSummary;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.streaming.MessageStreamIterator" {
  export class MessageStreamIterator<org.springaicommunity.claude.agent.sdk.parsing.ParsedMessage> {
    constructor();
    constructor(arg0: number, arg1: number);
    offer(arg0: org.springaicommunity.claude.agent.sdk.parsing.ParsedMessage): boolean;
    complete(): void;
    completeWithError(arg0: any): void;
    hasNext(): boolean;
    next(): org.springaicommunity.claude.agent.sdk.parsing.ParsedMessage;
    iterator(): Iterable<org.springaicommunity.claude.agent.sdk.parsing.ParsedMessage>;
    close(): void;
    isActive(): boolean;
    getBufferedCount(): number;
    next(): any;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.parsing.ControlMessageParser" {
  export class ControlMessageParser {
    constructor();
    constructor(arg0: number);
    constructor(arg0: any);
    constructor(arg0: any, arg1: number);
    parse(arg0: string): ParsedMessage;
    getMaxBufferSize(): number;
    parseFromNode(arg0: any, arg1: string): ParsedMessage;
    isControlRequest(arg0: string): boolean;
    extractRequestId(arg0: string): string;
    static DEFAULT_MAX_BUFFER_SIZE: number;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.parsing.ParsedMessage" {
  export class ParsedMessage {
    isRegularMessage(): boolean;
    isControlRequest(): boolean;
    isControlResponse(): boolean;
    asMessage(): Message;
    asControlRequest(): ControlRequest;
    asControlResponse(): ControlResponse;
    isRateLimitEvent(): boolean;
    asRateLimitEvent(): RateLimitEvent;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.parsing.JsonResultParser" {
  export class JsonResultParser {
    constructor();
    parseJsonResult(arg0: string): ResultMessage;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.parsing.RobustStreamParser" {
  export class RobustStreamParser {
    constructor();
    accumulateAndParse(arg0: string): Message | null;
    flushBuffer(): Message | null;
    clearBuffer(): void;
    getBufferSize(): number;
    getStats(): ParsingStats;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.parsing.MessageParser" {
  export class MessageParser {
    constructor();
    parseMessage(arg0: string): Message;
    parseMessageFromNode(arg0: any): Message;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.exceptions.SessionClosedException" {
  export class SessionClosedException {
    constructor(arg0: string);
    constructor(arg0: string, arg1: any);
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.exceptions.MessageParseException" {
  export class MessageParseException {
    constructor(arg0: string);
    constructor(arg0: string, arg1: Map<string, any>);
    constructor(arg0: string, arg1: any);
    constructor(arg0: string, arg1: string, arg2: any);
    getData(): Map<string, any>;
    getRawInput(): string;
    static withData(arg0: string, arg1: Map<string, any>): MessageParseException;
    static jsonDecodeError(arg0: string, arg1: any): MessageParseException;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.exceptions.TransportException" {
  export class TransportException {
    constructor(arg0: string);
    constructor(arg0: string, arg1: any);
    constructor(arg0: string, arg1: number, arg2: string);
    getExitCode(): number;
    getStderr(): string;
    static withExitCode(arg0: string, arg1: number): TransportException;
    static withStderr(arg0: string, arg1: string): TransportException;
    static cliNotFound(arg0: string): TransportException;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.exceptions.ClaudeSDKException" {
  export class ClaudeSDKException {
    constructor(arg0: string);
    constructor(arg0: string, arg1: any);
    constructor(arg0: any);
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.permission.ToolPermissionContext" {
  export class ToolPermissionContext {
    constructor(arg0: Map<string, any>[], arg1: string, arg2: string);
    hasBlockedPath(): boolean;
    hasPermissionSuggestions(): boolean;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    permissionSuggestions(): Map<string, any>[];
    blockedPath(): string;
    requestId(): string;
    static of(arg0: Map<string, any>[], arg1: string, arg2: string): ToolPermissionContext;
    static empty(): ToolPermissionContext;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.permission.PermissionResult" {
  export class PermissionResult {
    isAllowed(): boolean;
    static allow(): Allow;
    static allow(arg0: Map<string, any>): Allow;
    static deny(): Deny;
    static deny(arg0: string): Deny;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.permission.ToolPermissionCallback" {
  export class ToolPermissionCallback {
    checkPermission(arg0: string, arg1: Map<string, any>, arg2: ToolPermissionContext): PermissionResult;
    static allowAll(): ToolPermissionCallback;
    static denyAll(): ToolPermissionCallback;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.Message" {
  export class Message {
    getType(): string;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.AssistantMessage" {
  export class AssistantMessage {
    constructor(arg0: ContentBlock[]);
    getType(): string;
    getTextContent(): string | null;
    text(): string;
    toString(): string;
    getToolUses(): ToolUseBlock[];
    hasToolUse(): boolean;
    getTextBlocks(): TextBlock[];
    hashCode(): number;
    equals(arg0: any): boolean;
    content(): ContentBlock[];
    static of(arg0: ContentBlock[]): AssistantMessage;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.RateLimitEvent" {
  export class RateLimitEvent {
    constructor(arg0: string, arg1: RateLimitInfo, arg2: string, arg3: string);
    isAllowed(): boolean;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    type(): string;
    rateLimitInfo(): RateLimitInfo;
    uuid(): string;
    sessionId(): string;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.Usage" {
  export class Usage {
    constructor(arg0: number, arg1: number, arg2: number);
    constructor(arg0: number, arg1: number, arg2: number, arg3: number, arg4: number);
    getTotalInputTokens(): number;
    getTotalTokens(): number;
    getCompressionRatio(): number;
    getThinkingRatio(): number;
    exceedsLimit(arg0: number): boolean;
    getInputTokenPercentage(): number;
    getOutputTokenPercentage(): number;
    getCacheHitRatio(): number;
    isLargeResponse(): boolean;
    hasSignificantThinking(): boolean;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    inputTokens(): number;
    outputTokens(): number;
    thinkingTokens(): number;
    cacheCreationInputTokens(): number;
    cacheReadInputTokens(): number;
    static builder(): Builder;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.ResultMessage" {
  export class ResultMessage {
    constructor(arg0: string, arg1: number, arg2: number, arg3: boolean, arg4: number, arg5: string, arg6: number, arg7: Map<string, any>, arg8: string, arg9: any);
    getType(): string;
    toString(): string;
    toMetadata(arg0: string): Metadata;
    getStructuredOutputAs<T>(arg0: Class<T>, arg1: any): T;
    getStructuredOutputAsMap(): Map<string, any>;
    hasStructuredOutput(): boolean;
    hashCode(): number;
    equals(arg0: any): boolean;
    subtype(): string;
    durationMs(): number;
    durationApiMs(): number;
    isError(): boolean;
    numTurns(): number;
    sessionId(): string;
    totalCostUsd(): number;
    usage(): Map<string, any>;
    result(): string;
    structuredOutput(): any;
    static builder(): Builder;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.ContentBlock" {
  export class ContentBlock {
    getType(): string;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.control.HookOutput" {
  export class HookOutput {
    constructor(arg0: boolean, arg1: boolean, arg2: string, arg3: string, arg4: string, arg5: string, arg6: boolean, arg7: number, arg8: HookSpecificOutput);
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    continueExecution(): boolean;
    suppressOutput(): boolean;
    stopReason(): string;
    decision(): string;
    systemMessage(): string;
    reason(): string;
    asyncExecution(): boolean;
    asyncTimeout(): number;
    hookSpecificOutput(): HookSpecificOutput;
    static allow(): HookOutput;
    static block(arg0: string): HookOutput;
    static async(): HookOutput;
    static async(arg0: number): HookOutput;
    static builder(): Builder;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.control.ControlResponse" {
  export class ControlResponse {
    constructor(arg0: string, arg1: ResponsePayload);
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    type(): string;
    response(): ResponsePayload;
    static success(arg0: string, arg1: any): ControlResponse;
    static error(arg0: string, arg1: string): ControlResponse;
    static TYPE: string;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.control.HookInput" {
  export class HookInput {
    hookEventName(): string;
    sessionId(): string;
    transcriptPath(): string;
    cwd(): string;
    permissionMode(): string | null;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.control.ControlRequest" {
  export class ControlRequest {
    constructor(arg0: string, arg1: string, arg2: ControlRequestPayload);
    isControlRequest(): boolean;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    type(): string;
    requestId(): string;
    request(): ControlRequestPayload;
    static TYPE: string;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.control.HookEvent" {
  export class HookEvent<org.springaicommunity.claude.agent.sdk.types.control.HookEvent> {
    getProtocolName(): string;
    static values(): org.springaicommunity.claude.agent.sdk.types.control.HookEvent[];
    static valueOf(arg0: string): org.springaicommunity.claude.agent.sdk.types.control.HookEvent;
    static fromProtocolName(arg0: string): org.springaicommunity.claude.agent.sdk.types.control.HookEvent;
    static PRE_TOOL_USE: org.springaicommunity.claude.agent.sdk.types.control.HookEvent;
    static POST_TOOL_USE: org.springaicommunity.claude.agent.sdk.types.control.HookEvent;
    static USER_PROMPT_SUBMIT: org.springaicommunity.claude.agent.sdk.types.control.HookEvent;
    static STOP: org.springaicommunity.claude.agent.sdk.types.control.HookEvent;
    static SUBAGENT_STOP: org.springaicommunity.claude.agent.sdk.types.control.HookEvent;
    static PRE_COMPACT: org.springaicommunity.claude.agent.sdk.types.control.HookEvent;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.UserMessage" {
  export class UserMessage {
    constructor(arg0: any);
    getType(): string;
    toString(): string;
    getContentAsString(): string;
    getContentAsBlocks(): ContentBlock[];
    hashCode(): number;
    equals(arg0: any): boolean;
    content(): any;
    static of(arg0: string): UserMessage;
    static of(arg0: ContentBlock[]): UserMessage;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.ToolUseBlock" {
  export class ToolUseBlock {
    constructor(arg0: string, arg1: string, arg2: Map<string, any>);
    getType(): string;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    id(): string;
    name(): string;
    input(): Map<string, any>;
    static builder(): Builder;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.ToolResultBlock" {
  export class ToolResultBlock {
    constructor(arg0: string, arg1: any, arg2: boolean);
    getType(): string;
    getContentAsString(): string;
    getContentAsList(): Map<string, any>[];
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    toolUseId(): string;
    content(): any;
    isError(): boolean;
    static builder(): Builder;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.JsonSchema" {
  export class JsonSchema {
    constructor(arg0: string, arg1: Map<string, any>, arg2: string[], arg3: boolean, arg4: Map<string, any>);
    toMap(): Map<string, any>;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    type(): string;
    properties(): Map<string, any>;
    required(): string[];
    additionalProperties(): boolean;
    defs(): Map<string, any>;
    static ofObject(arg0: Map<string, any>, arg1: string[]): JsonSchema;
    static ofObject(arg0: Map<string, any>): JsonSchema;
    static fromMap(arg0: Map<string, any>): JsonSchema;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.Metadata" {
  export class Metadata {
    constructor(arg0: string, arg1: Cost, arg2: Usage, arg3: number, arg4: number, arg5: string, arg6: number);
    getDuration(): any;
    getApiDuration(): any;
    getEfficiencyScore(): number;
    getApiOverheadRatio(): number;
    isExpensive(): boolean;
    getTokensPerSecond(): number;
    getLatencyPerToken(): number;
    isMultiTurn(): boolean;
    isFastResponse(): boolean;
    toMetricsMap(): Map<string, any>;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    model(): string;
    cost(): Cost;
    usage(): Usage;
    durationMs(): number;
    apiDurationMs(): number;
    sessionId(): string;
    numTurns(): number;
    static builder(): Builder;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.TextBlock" {
  export class TextBlock {
    constructor(arg0: string);
    getType(): string;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    text(): string;
    static of(arg0: string): TextBlock;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.ResultStatus" {
  export const ResultStatus: {
    readonly SUCCESS: org.springaicommunity.claude.agent.sdk.types.ResultStatus;
    readonly ERROR: org.springaicommunity.claude.agent.sdk.types.ResultStatus;
    readonly PARTIAL: org.springaicommunity.claude.agent.sdk.types.ResultStatus;
    readonly TIMEOUT: org.springaicommunity.claude.agent.sdk.types.ResultStatus;
    readonly CANCELLED: org.springaicommunity.claude.agent.sdk.types.ResultStatus;
    values(): org.springaicommunity.claude.agent.sdk.types.ResultStatus[];
    valueOf(arg0: string): org.springaicommunity.claude.agent.sdk.types.ResultStatus;
  };
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.RateLimitInfo" {
  export class RateLimitInfo {
    constructor(arg0: string, arg1: number, arg2: string, arg3: string, arg4: string, arg5: boolean);
    isAllowed(): boolean;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    status(): string;
    resetsAt(): number;
    rateLimitType(): string;
    overageStatus(): string;
    overageDisabledReason(): string;
    isUsingOverage(): boolean;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.Cost" {
  export class Cost {
    constructor(arg0: number, arg1: number, arg2: number, arg3: number, arg4: string);
    calculateTotal(): number;
    calculateWithMarkup(arg0: number): number;
    calculatePerToken(): number;
    getInputCostPerThousandTokens(): number;
    getOutputCostPerThousandTokens(): number;
    isExpensive(): boolean;
    getEfficiencyRatio(): number;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    inputTokenCost(): number;
    outputTokenCost(): number;
    inputTokens(): number;
    outputTokens(): number;
    model(): string;
    static builder(): Builder;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.QueryResult" {
  export class QueryResult {
    constructor(arg0: Message[], arg1: Metadata, arg2: ResultStatus);
    text(): string | null;
    allText(): string[];
    getFirstAssistantResponse(): string | null;
    hasToolUse(): boolean;
    getAllToolUses(): ToolUseBlock[];
    getAssistantMessages(): AssistantMessage[];
    getUserMessages(): UserMessage[];
    getResultMessage(): ResultMessage | null;
    isSuccessful(): boolean;
    isError(): boolean;
    getMessageCount(): number;
    isExpensive(): boolean;
    isFastResponse(): boolean;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    messages(): Message[];
    metadata(): Metadata;
    status(): ResultStatus;
    static builder(): Builder;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.SystemMessage" {
  export class SystemMessage {
    constructor(arg0: string, arg1: Map<string, any>);
    getType(): string;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    subtype(): string;
    data(): Map<string, any>;
    static of(arg0: string, arg1: Map<string, any>): SystemMessage;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.types.ThinkingBlock" {
  export class ThinkingBlock {
    constructor(arg0: string, arg1: string);
    getType(): string;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    thinking(): string;
    signature(): string;
    static of(arg0: string): ThinkingBlock;
    static of(arg0: string, arg1: string): ThinkingBlock;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.hooks.HookCallback" {
  export class HookCallback {
    handle(arg0: HookInput): HookOutput;
    static allow(): HookCallback;
    static block(arg0: string): HookCallback;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.hooks.HookRegistration" {
  export class HookRegistration {
    constructor(arg0: string, arg1: HookEvent, arg2: any, arg3: HookCallback, arg4: number);
    constructor(arg0: string, arg1: HookEvent, arg2: any, arg3: HookCallback);
    constructor(arg0: string, arg1: HookEvent, arg2: HookCallback);
    matchesTool(arg0: string): boolean;
    getPatternString(): string;
    toString(): string;
    hashCode(): number;
    equals(arg0: any): boolean;
    id(): string;
    event(): HookEvent;
    toolPattern(): any;
    callback(): HookCallback;
    timeout(): number;
    static builder(): Builder;
    static preToolUse(arg0: string, arg1: string, arg2: HookCallback): HookRegistration;
    static preToolUse(arg0: string, arg1: HookCallback): HookRegistration;
    static postToolUse(arg0: string, arg1: string, arg2: HookCallback): HookRegistration;
    static postToolUse(arg0: string, arg1: HookCallback): HookRegistration;
    static userPromptSubmit(arg0: string, arg1: HookCallback): HookRegistration;
    static stop(arg0: string, arg1: HookCallback): HookRegistration;
    static DEFAULT_TIMEOUT: number;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.hooks.HookRegistry" {
  export class HookRegistry {
    constructor();
    register(arg0: HookRegistration): HookRegistry;
    register(arg0: HookEvent, arg1: string, arg2: HookCallback): string;
    registerPreToolUse(arg0: string, arg1: HookCallback): string;
    registerPreToolUse(arg0: HookCallback): string;
    registerPostToolUse(arg0: string, arg1: HookCallback): string;
    registerPostToolUse(arg0: HookCallback): string;
    registerUserPromptSubmit(arg0: HookCallback): string;
    registerStop(arg0: HookCallback): string;
    unregister(arg0: string): boolean;
    getById(arg0: string): HookRegistration;
    getByEvent(arg0: HookEvent): HookRegistration[];
    getRegisteredIds(): Set<string>;
    hasHooks(): boolean;
    clear(): void;
    executeHook(arg0: string, arg1: HookInput): HookOutput;
    buildHookConfig(): Map<string, HookMatcherConfig[]>;
    createInitializeRequest(arg0: string): ControlRequest;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.ClaudeAsyncClient" {
  export class ClaudeAsyncClient {
    connect(): Mono<void>;
    connect(arg0: string): TurnSpec;
    isConnected(): boolean;
    query(arg0: string): TurnSpec;
    receiveMessages(): Flux<ParsedMessage>;
    receiveResponse(): Flux<Message>;
    queryAndReceive(arg0: string): Flux<Message>;
    connectAndReceive(arg0: string): Flux<Message>;
    connectText(arg0: string): Flux<string>;
    queryText(arg0: string): Flux<string>;
    interrupt(): Mono<void>;
    setPermissionMode(arg0: string): Mono<void>;
    setModel(arg0: string): Mono<void>;
    getServerInfo(): Map<string, any> | null;
    setToolPermissionCallback(arg0: ToolPermissionCallback): void;
    getToolPermissionCallback(): ToolPermissionCallback;
    onMessage(arg0: (value: Message) => void): ClaudeAsyncClient;
    onResult(arg0: (value: ResultMessage) => void): ClaudeAsyncClient;
    close(): Mono<void>;
    disconnect(): Mono<void>;
  }
}

declare module "java:org.springaicommunity.claude.agent.sdk.ClaudeSyncClient" {
  export class ClaudeSyncClient {
    connect(): void;
    connect(arg0: string): void;
    query(arg0: string): void;
    query(arg0: string, arg1: string): void;
    receiveMessages(): Iterable<ParsedMessage>;
    receiveResponse(): Iterable<ParsedMessage>;
    messages(): Iterable<Message>;
    connectAndReceive(arg0: string): Iterable<Message>;
    queryAndReceive(arg0: string): Iterable<Message>;
    connectText(arg0: string): string;
    queryText(arg0: string): string;
    messageReceiver(): MessageReceiver;
    responseReceiver(): MessageReceiver;
    interrupt(): void;
    setPermissionMode(arg0: string): void;
    setModel(arg0: string): void;
    getServerInfo(): Map<string, any>;
    getCurrentModel(): string;
    getCurrentPermissionMode(): string;
    setToolPermissionCallback(arg0: ToolPermissionCallback): void;
    getToolPermissionCallback(): ToolPermissionCallback;
    isConnected(): boolean;
    disconnect(): void;
    close(): void;
  }
}
