class UncaughtPromiseError extends Error {
  constructor(error: any) {
    super(error);
    this.stack = `(in promise ) ${error.stack}`;
  }
}

type Status = "PENDING" | "FULFILLED" | "REJECTED";

export class MyPromise<Value = unknown> {
  private thenCb: Function[] = [];
  private catchCb: Function[] = [];
  private value?: Value | string;
  private status: Status = "PENDING";
  private onSuccessBinded = this.onSuccess.bind(this);
  private onFailureBinded = this.onFailure.bind(this);

  constructor(
    cb: (
      resolve: (value: Value) => void,
      reject: (value: Value) => void
    ) => void
  ) {
    try {
      cb(this.onSuccessBinded, this.onFailureBinded);
    } catch (err) {
      this.onFailure(err as Value);
    }
  }

  private notifySubscribers() {
    if (this.status === "FULFILLED") {
      this.thenCb.forEach((cb) => cb(this.value));
      this.thenCb = [];
    } else if (this.status === "REJECTED") {
      this.catchCb.forEach((cb) => cb(this.value));
      this.catchCb = [];
    }
  }

  private onSuccess(value: Value) {
    queueMicrotask(() => {
      if (this.status === "PENDING") {
        if (value instanceof MyPromise) {
          value.then(this.onSuccessBinded, this.onFailureBinded);
        } else {
          this.value = value;
          this.status = "FULFILLED";
          this.notifySubscribers();
        }
      }
    });
  }

  private onFailure(error: unknown) {
    queueMicrotask(() => {
      if (this.status === "PENDING") {
        if (this.catchCb.length === 0) {
          throw new UncaughtPromiseError(error);
        }
        if (error instanceof MyPromise) {
          error.then(this.onSuccessBinded, this.onFailureBinded);
        } else {
          queueMicrotask(() => {
            this.value = error as Value;
            this.status = "REJECTED";
            this.notifySubscribers();
          });
        }
      }
    });
  }

  then(
    resolveCb?: (value: Value) => unknown,
    rejectCb?: (value: Value) => unknown
  ) {
    return new MyPromise((resolve, reject) => {
      this.thenCb.push((result: Value) => {
        if (resolveCb === undefined) {
          resolve(result);
        } else {
          try {
            const res = resolveCb(result);
            resolve(res);
          } catch (err) {
            reject(err);
          }
        }
      });
      //we call the param "result" and not "err" because we can get the returned value from a then function and we need to pass it to the next "then" function, in this case: then(x=>x).catch().then(x=>x)
      this.catchCb.push((result: Value) => {
        if (rejectCb === undefined) {
          reject(result);
        } else {
          try {
            const res = rejectCb(result);
            resolve(res);
          } catch (err) {
            reject(err);
          }
        }
      });
      this.notifySubscribers();
    });
  }

  catch(rejectCb?: (value: Value) => unknown) {
    return this.then(undefined, rejectCb);
  }

  finally(cb?: () => void) {
    return this.then(
      (results) => {
        cb?.();
        return results;
      },
      (error) => {
        cb?.();
        return error;
      }
    );
  }

  static resolve(value: unknown) {
    return new MyPromise((resolve) => {
      resolve(value);
    });
  }

  static reject(value: unknown) {
    return new MyPromise((_, reject) => {
      reject(value);
    });
  }

  static all(promises: MyPromise[]) {
    return new MyPromise((resolve, reject) => {
      const results: unknown[] = [];
      let completedPromisesCounter = 0;
      promises.forEach((promise, index) => {
        promise
          .then((res) => {
            results[index] = res;
            completedPromisesCounter++;
            if (completedPromisesCounter === promises.length) {
              resolve(results);
            }
          })
          .catch(reject);
      });
    });
  }

  static allSettled<T extends readonly MyPromise[]>(promises: T) {
    return new MyPromise<unknown[]>((resolve, reject) => {
      const results: unknown[] = [];
      let completedPromisesCounter = 0;
      promises.forEach((promise, index) => {
        promise
          .then((res) => {
            results[index] = { status: "fulfilled", value: res };
            completedPromisesCounter++;
            if (completedPromisesCounter === promises.length) {
              resolve(results);
            }
          })
          .catch((res) => {
            results[index] = { status: "rejected", reason: res };
            completedPromisesCounter++;
            if (completedPromisesCounter === promises.length) {
              resolve(results);
            }
          });
      });
    });
  }

  static race(promises: MyPromise[]) {
    return new MyPromise((resolve, reject) => {
      let firstPromise = true;
      promises.forEach((promise) => {
        promise
          .then((res) => {
            if (firstPromise) {
              resolve(res);
              firstPromise = false;
            }
          })
          .catch((error) => {
            if (firstPromise) {
              reject(error);
              firstPromise = false;
            }
          });
      });
    });
  }

  static any(promises: MyPromise[]) {
    return new MyPromise((resolve, reject) => {
      let firstResolvedPromise = true;
      let rejectedPromisesCounter = 0;
      promises.forEach((promise) => {
        promise
          .then((res) => {
            if (firstResolvedPromise) {
              resolve(res);
              firstResolvedPromise = false;
            }
          })
          .catch((error) => {
            rejectedPromisesCounter++;
            if (rejectedPromisesCounter === promises.length) {
              reject("All promises were rejected");
            }
          });
      });
    });
  }
}
