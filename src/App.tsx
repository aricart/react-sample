import React, { useEffect } from 'react';
import { useState } from 'react';
import {connect, NatsConnection, JSONCodec, ServiceError, ServiceStats} from 'nats.ws'
import './App.css';

function App() {
  const [nc, setConnection] = useState<NatsConnection>();
  const [lastError, setError] = useState<string>("");
  const [lastRequest, setLastRequest] = useState<(number|string)[]>(["?"]);
  const [lastResult, setLastResult] = useState<number|string>("?");
  useState(() => {
    if(!nc) {
      connect({servers: ["wss://demo.nats.io:8443"]})
      .then((nc: NatsConnection) => {
        setConnection(nc);
        nc.services.add({
          name: "service-on-a-browser",
          version: "0.0.1",
          description: "this runs in a browser!",
        })
        .then((srv) => {
          const g = srv.addGroup("calculator");
          g.addEndpoint("sum", (err, m) => {
            if(err) {
              setError(err.message);
              srv.stop(err);
              return;
            }
            const nums = JSONCodec<number[]>().decode(m.data);
            if(nums.length === 0) {
              m.respondError(500, "need at least one value");
              return;
            }
            const r = nums.reduce((sum, v) => {
              return sum + v;
            });
            m.respond(JSONCodec<number>().encode(r));
          })
        })
      })
      .catch((err) => {
        setError(err.message);
        console.error(err);
      });
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const nums: number[] = [];
      for(let i=0; i < 3; i++) {
        nums.push(parseInt(`${Math.random() * 100}`));
      }
      setLastRequest(nums);
      setLastResult("?");
      nc?.request("calculator.sum", JSONCodec<number[]>().encode(nums))
      .then((m) => {
        if(ServiceError.isServiceError(m)) {
          const err = ServiceError.toServiceError(m);
          setError(err?.message ?? "");
        } else {
          setLastResult(JSONCodec<number>().decode(m.data));
        }
      })
      .catch((err) => {
        setError(err.message);
      })
    }, 5000);
    return () => clearInterval(interval);
  }, [nc])


  return (
    <div className="App">
      <h1>{nc ? `connected ${nc.getServer()}` : "not yet connected"}</h1>
      <h3>{lastError ? lastError : ""}</h3>
      <code>
        {`${lastRequest.join("+")}=${lastResult}`};
      </code>
    </div>
  );
}

export default App;
