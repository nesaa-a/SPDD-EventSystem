import { useState, useEffect } from 'react';
import { reportingAPI } from '../services/api';

function ChartsDashboard() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      setLoading(true);
      const data = await reportingAPI.getStats();
      setReportData(data);
    } catch (err) {
      setError(err.message || 'Failed to load reporting data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px'}}>
        <div>Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', color: '#b91c1c'}}>
        {error}
      </div>
    );
  }

  const categories = reportData?.category_breakdown ? Object.entries(reportData.category_breakdown) : [];
  const maxCategoryCount = Math.max(...categories.map(([, count]) => count), 1);
  const events = reportData?.events_breakdown?.slice(0, 8) || [];

  return (
    <div>
      <h1 style={{fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', marginBottom: '24px'}}>📊 Analytics Dashboard</h1>

      {/* Summary Cards */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px'}}>
        <div style={{background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '12px', padding: '20px', color: 'white'}}>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{reportData?.total_events || 0}</div>
          <div style={{opacity: 0.9}}>Total Events</div>
        </div>
        <div style={{background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderRadius: '12px', padding: '20px', color: 'white'}}>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{reportData?.total_participants || 0}</div>
          <div style={{opacity: 0.9}}>Total Participants</div>
        </div>
        <div style={{background: 'linear-gradient(135deg, #a855f7, #9333ea)', borderRadius: '12px', padding: '20px', color: 'white'}}>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{reportData?.events_with_participants || 0}</div>
          <div style={{opacity: 0.9}}>Active Events</div>
        </div>
        <div style={{background: 'linear-gradient(135deg, #eab308, #ca8a04)', borderRadius: '12px', padding: '20px', color: 'white'}}>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{reportData?.total_waitlist || 0}</div>
          <div style={{opacity: 0.9}}>On Waitlist</div>
        </div>
        <div style={{background: 'linear-gradient(135deg, #14b8a6, #0d9488)', borderRadius: '12px', padding: '20px', color: 'white'}}>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{reportData?.checked_in_count || 0}</div>
          <div style={{opacity: 0.9}}>Checked In</div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginBottom: '32px'}}>
        {/* Category Breakdown */}
        <div style={{backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '24px', border: '1px solid #e5e7eb'}}>
          <h2 style={{fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', marginBottom: '20px'}}>📁 Events by Category</h2>
          {categories.length === 0 ? (
            <p style={{color: '#6b7280', textAlign: 'center', padding: '32px'}}>No category data available</p>
          ) : (
            <div>
              {categories.map(([category, count]) => (
                <div key={category} style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
                  <div style={{width: '80px', fontSize: '13px', color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{category}</div>
                  <div style={{flex: 1, backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '24px', overflow: 'hidden'}}>
                    <div style={{
                      background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                      height: '100%',
                      borderRadius: '9999px',
                      width: `${(count / maxCategoryCount) * 100}%`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: '8px',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '500',
                      minWidth: '30px'
                    }}>
                      {count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fill Rate */}
        <div style={{backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '24px', border: '1px solid #e5e7eb'}}>
          <h2 style={{fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', marginBottom: '20px'}}>📈 Event Fill Rates</h2>
          {events.length === 0 ? (
            <p style={{color: '#6b7280', textAlign: 'center', padding: '32px'}}>No event data available</p>
          ) : (
            <div>
              {events.map((event) => {
                const fillRate = event.fill_rate || 0;
                let barColor = '#22c55e';
                if (fillRate >= 90) barColor = '#ef4444';
                else if (fillRate >= 70) barColor = '#eab308';
                
                return (
                  <div key={event.id} style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
                    <div style={{width: '100px', fontSize: '13px', color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={event.title}>{event.title}</div>
                    <div style={{flex: 1, backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '24px', overflow: 'hidden'}}>
                      <div style={{
                        backgroundColor: barColor,
                        height: '100%',
                        borderRadius: '9999px',
                        width: `${Math.max(fillRate, 5)}%`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '8px',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {fillRate}%
                      </div>
                    </div>
                    <div style={{fontSize: '12px', color: '#6b7280', width: '50px', textAlign: 'right'}}>
                      {event.participants}/{event.capacity}
                    </div>
                  </div>
                );
              })}
              <div style={{marginTop: '16px', display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280'}}>
                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}><span style={{width: '12px', height: '12px', backgroundColor: '#22c55e', borderRadius: '2px', display: 'inline-block'}}></span> Under 70%</span>
                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}><span style={{width: '12px', height: '12px', backgroundColor: '#eab308', borderRadius: '2px', display: 'inline-block'}}></span> 70-90%</span>
                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}><span style={{width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '2px', display: 'inline-block'}}></span> Over 90%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Events Breakdown Table */}
      <div style={{backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '24px', border: '1px solid #e5e7eb'}}>
        <h2 style={{fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', marginBottom: '20px'}}>📋 Events Detail</h2>
        <div style={{overflowX: 'auto'}}>
          <table style={{width: '100%', fontSize: '14px', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb'}}>
                <th style={{textAlign: 'left', padding: '12px 16px', fontWeight: '600'}}>Event</th>
                <th style={{textAlign: 'center', padding: '12px 16px', fontWeight: '600'}}>Participants</th>
                <th style={{textAlign: 'center', padding: '12px 16px', fontWeight: '600'}}>Capacity</th>
                <th style={{textAlign: 'center', padding: '12px 16px', fontWeight: '600'}}>Waitlist</th>
                <th style={{textAlign: 'center', padding: '12px 16px', fontWeight: '600'}}>Fill Rate</th>
                <th style={{textAlign: 'center', padding: '12px 16px', fontWeight: '600'}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.events_breakdown?.map((event) => (
                <tr key={event.id} style={{borderBottom: '1px solid #e5e7eb'}}>
                  <td style={{padding: '12px 16px', fontWeight: '500'}}>{event.title}</td>
                  <td style={{textAlign: 'center', padding: '12px 16px'}}>{event.participants}</td>
                  <td style={{textAlign: 'center', padding: '12px 16px'}}>{event.capacity}</td>
                  <td style={{textAlign: 'center', padding: '12px 16px'}}>{event.waitlist || 0}</td>
                  <td style={{textAlign: 'center', padding: '12px 16px'}}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: event.fill_rate >= 90 ? '#fee2e2' : event.fill_rate >= 70 ? '#fef3c7' : '#dcfce7',
                      color: event.fill_rate >= 90 ? '#b91c1c' : event.fill_rate >= 70 ? '#b45309' : '#15803d'
                    }}>
                      {event.fill_rate}%
                    </span>
                  </td>
                  <td style={{textAlign: 'center', padding: '12px 16px'}}>
                    {event.participants >= event.capacity ? (
                      <span style={{color: '#dc2626', fontWeight: '500'}}>Full</span>
                    ) : (
                      <span style={{color: '#16a34a', fontWeight: '500'}}>Open</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ChartsDashboard;
