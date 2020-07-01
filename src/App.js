import React, { useEffect, useState } from 'react';
import logo from './logo.png';
import './App.css';
import useRecursiveTimeout from './useRecursiveTimeout';
// import useInterval from './useInterval';
import * as moment from 'moment-timezone';
import AWS from 'aws-sdk';
import cx from 'classnames';
import preval from 'preval.macro';

const App = () => {

  const [ ready, setReady ] = useState(true);
  const [ msg, setMsg ] = useState('Loading...');

  // check if we have an AWS Config
  if (
    ready && (
      !process.env.REACT_APP_AWS_CONNECT_INSTANCE_ID ||
      !process.env.REACT_APP_AWS_ACCESS_KEY_ID ||
      !process.env.REACT_APP_AWS_SECRET_ACCESS_KEY ||
      !process.env.REACT_APP_AWS_DEFAULT_REGION
    )
  ) {
    setMsg('App not setup properly');
    setReady(false);
  }

  // setup credentials and an aws connect object
  const [credentials] = useState(new AWS.Credentials(process.env.REACT_APP_AWS_ACCESS_KEY_ID, process.env.REACT_APP_AWS_SECRET_ACCESS_KEY));
  const [connect] = useState(
    new AWS.Connect({
      apiVersion: '2017-08-08',
      region: process.env.REACT_APP_AWS_DEFAULT_REGION,
      credentials,
    })
  );

  // setup a hearbeat
  const [time, setTime] = useState(moment().toDate());
  useRecursiveTimeout(() => {

    if (!ready)
      return;

    setTime(moment().toDate());
  }, (process.env.REACT_APP_UPDATE_FREQUENCY || 15) * 1000);

  // load a list of queues
  const [ queues, setQueues ] = useState(null);
  useEffect(() => {

    if (!ready)
      return;

    async function fetchData() {
      // https://docs.aws.amazon.com/connect/latest/APIReference/API_ListQueues.html
      console.info('connect.listQueues');
      connect.listQueues({
        InstanceId: process.env.REACT_APP_AWS_CONNECT_INSTANCE_ID,
        QueueTypes: [ 'STANDARD' ],
      }, (err, data) => {
        if (err) {
          console.log(err, err.stack);
          setMsg('Unable to list queues');
          return;
        }
        console.log({ queues: data });
        setQueues(data);
      });
    }
    fetchData();

  }, [ ready, connect ]);

  // load current metric data
  const [metrics, setMetrics] = useState(null);
  useEffect(() => {

    if (!ready || queues===null)
      return;

    if (queues.length===0) {
      setMsg('No queues available');
      return;
    }

    const queueIds = queues.QueueSummaryList.map(queue => queue.Id);
    
    console.info('connect.getCurrentMetricData');
    async function fetchData() {
      connect.getCurrentMetricData({
        InstanceId: process.env.REACT_APP_AWS_CONNECT_INSTANCE_ID,
        Filters: {
          // 'Channels' => [
          //     'VOICE',
          //     'CHAT',
          // ],
          Queues: queueIds,
          // [
          //     'BasicQueue',
          //     'Pharmacy',
          //     'Pharmacy (SP)',
          // ],
        },
        // Groupings: [ 'QUEUE' ],
        CurrentMetrics: [
          {
            Name: 'AGENTS_AFTER_CONTACT_WORK',
            Unit: 'COUNT',
          },
          {
            Name: 'AGENTS_AVAILABLE',
            Unit: 'COUNT',
          },
          {
            Name: 'AGENTS_ERROR',
            Unit: 'COUNT',
          },
          {
            Name: 'AGENTS_NON_PRODUCTIVE',
            Unit: 'COUNT',
          },
          // {
          //   Name: 'AGENTS_ON_CALL',
          //   Unit: 'COUNT',
          // },
          {
            Name: 'AGENTS_ON_CONTACT',
            Unit: 'COUNT',
          },
          {
            Name: 'AGENTS_ONLINE',
            Unit: 'COUNT',
          },
          {
            Name: 'AGENTS_STAFFED',
            Unit: 'COUNT',
          },
          {
            Name: 'CONTACTS_IN_QUEUE',
            Unit: 'COUNT',
          },
          {
            Name: 'CONTACTS_SCHEDULED',
            Unit: 'COUNT',
          },
          {
            Name: 'OLDEST_CONTACT_AGE',
            Unit: 'SECONDS', // If no grouping, gets returned in milliseconds, not seconds
          },
          {
            Name: 'SLOTS_ACTIVE',
            Unit: 'COUNT',
          },
          {
            Name: 'SLOTS_AVAILABLE',
            Unit: 'COUNT',
          },
        ],
      }, (err, data) => {
        if (err) {
          console.log(err, err.stack);
          setMsg('Unable to get metrics');
          return;
        }
        console.log({ metrics: data });
        if (data.MetricResults.length===0) {
          const lastUpdate = moment(data.DataSnapshotTime);
          setMetrics(null);
          setMsg(`No metrics available - ${lastUpdate.format('LLL')}`);
        } else {
          setMetrics(data);
          setMsg('');
        }
      });
    }
    fetchData();

  }, [ ready, connect, queues, time ]);

  if (msg) {
    return (
      <div className="App">
        <div className="App-message">
          <img src={logo} className="App-logo" alt="logo" />
          <p>{msg}</p>
        </div>
      </div>
    );
  }

  const lastUpdate = moment(metrics.DataSnapshotTime);
  const now = moment();
  const outdated = process.env.REACT_APP_UPDATE_OUTDATED_THRESHOLD || 15;
  const current = lastUpdate.add(outdated, 'second').isAfter(now);

  return (
    <div className="App">
      <div className="App-metrics">
        <header
          className={cx({
            'App-header': true,
            'App-red': !current,
          })}
        >
          Last Update: {lastUpdate.format('LLL')}
        </header>
        <main className="App-body">
          {[1,2,3,4].map(i => {

            let metricDisplay = process.env[`REACT_APP_QUADRANT_${i}_METRIC_DISPLAY`] || '';
            let metricDesc = process.env[`REACT_APP_QUADRANT_${i}_METRIC_DESC`] || '';
            let metricGreen = process.env[`REACT_APP_QUADRANT_${i}_GREEN`] || '';
            let metricYellow = process.env[`REACT_APP_QUADRANT_${i}_YELLOW`] || '';
            let metricRed = process.env[`REACT_APP_QUADRANT_${i}_RED`] || '';

            metrics.MetricResults[0].Collections.forEach(metric => {

              const metricName = metric.Metric.Name;
              let metricValue = metric.Value;
              // There is a bug when grouping is not used, oldest contact time is returned in milliseconds
              if (metricName==='OLDEST_CONTACT_AGE')
                metricValue /= 60000;

              metricDisplay = metricDisplay.split(metricName).join(metricValue);
              metricDesc = metricDesc.split(metricName).join(metricValue);
              metricGreen = metricGreen.split(metricName).join(metricValue);
              metricYellow = metricYellow.split(metricName).join(metricValue);
              metricRed = metricRed.split(metricName).join(metricValue);
            });

            let isGreen = false;
            let isYellow = false;
            let isRed = false;
            try {
              // eslint-disable-next-line
              isGreen = Function(`"use strict";return (${metricGreen || 'false'});`)();
              // eslint-disable-next-line
              isYellow = Function(`"use strict";return (${metricYellow || 'false'});`)();
              // eslint-disable-next-line
              isRed = Function(`"use strict";return (${metricRed || 'false'});`)();
            } catch (e) {
              console.warn(e);
              isGreen = false;
              isYellow = false;
              isRed = false;
            }

            // console.log({
            //   metricDisplay,
            //   metricDesc,
            //   metricGreen,
            //   metricYellow,
            //   metricRed,
            //   isGreen,
            //   isYellow,
            //   isRed,
            // });

            return (
              <div
                key={i} 
                className={cx({
                  "App-quadrant": true,
                  "App-red": isRed,
                  "App-yellow": isYellow && !isRed,
                  "App-green": isGreen && !isYellow && !isYellow,
                })}
              >
                <div>
                  <p className="App-huge">{metricDisplay}</p>
                  <p>{metricDesc}</p>
                </div>
              </div>
            );
          })}
          {/* {metrics.MetricResults.map((metricResult, k) => {

            let currentQueue = null;
            if (metricResult.Dimensions)
              currentQueue = queues.QueueSummaryList.find(queue => queue.Id===metricResult.Dimensions.Queue.Id);

            return (
              <div key={currentQueue ? currentQueue.Id : k}>
                {currentQueue ? <h2>{currentQueue.Name}</h2> : ''}
                {metricResult.Collections.map(metric => {
                  return (
                    <div key={metric.Metric.Name}>
                      <b>{metric.Metric.Name}:</b> {metric.Value} {metric.Metric.Unit}
                    </div>
                  );
                })}
              </div>
            );
          })} */}
        </main>
        <footer className="App-footer">
          {preval`
            const moment = require('moment-timezone');
            const now = moment().tz("America/Los_Angeles");
            const format = 'YYYY-MM-DD HH:mm:ss';
            module.exports = now.format(format);
          `}
        </footer>
      </div>
    </div>
  );
}

export default App;
