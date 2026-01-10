import React, { useState, useEffect } from 'react';
import { systemAPI, cacheAPI, analyticsAPI, auditAPI, dataQualityAPI, searchAPI } from '../services/api';

const SystemDashboard = () => {
  const [activeTab, setActiveTab] = useState('status');
  const [systemStatus, setSystemStatus] = useState(null);
  const [cacheStats, setCacheStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [clustering, setClustering] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [auditLogs, setAuditLogs] = useState(null);
  const [auditVerification, setAuditVerification] = useState(null);
  const [dataQuality, setDataQuality] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSystemStatus();
  }, []);

  useEffect(() => {
    if (activeTab === 'cache') loadCacheStats();
    if (activeTab === 'analytics') loadAnalytics();
    if (activeTab === 'audit') loadAuditLogs();
    if (activeTab === 'quality') loadDataQuality();
  }, [activeTab]);

  const loadSystemStatus = async () => {
    try {
      setLoading(true);
      const data = await systemAPI.getStatus();
      setSystemStatus(data);
    } catch (err) {
      setError('Failed to load system status');
    } finally {
      setLoading(false);
    }
  };

  const loadCacheStats = async () => {
    try {
      const data = await cacheAPI.getStats();
      setCacheStats(data);
    } catch (err) {
      setCacheStats({ available: false, error: err.message });
    }
  };

  const loadAnalytics = async () => {
    try {
      const [summary, clusterData, anomalyData] = await Promise.all([
        analyticsAPI.getSummary(),
        analyticsAPI.getClustering().catch(() => ({ clusters: [] })),
        analyticsAPI.getAnomalies().catch(() => ({ anomalies: [] }))
      ]);
      setAnalytics(summary);
      setClustering(clusterData);
      setAnomalies(anomalyData);
    } catch (err) {
      setError('Failed to load analytics');
    }
  };

  const loadAuditLogs = async () => {
    try {
      const [logs, verification] = await Promise.all([
        auditAPI.getLogs({ page: 1, size: 20 }),
        auditAPI.verifyChain()
      ]);
      setAuditLogs(logs);
      setAuditVerification(verification);
    } catch (err) {
      setError('Failed to load audit logs');
    }
  };

  const loadDataQuality = async () => {
    try {
      const data = await dataQualityAPI.getReport();
      setDataQuality(data);
    } catch (err) {
      setError('Failed to load data quality report');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setLoading(true);
      const results = await searchAPI.search(searchQuery);
      setSearchResults(results);
    } catch (err) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    try {
      await cacheAPI.clear('*');
      loadCacheStats();
      alert('Cache cleared successfully');
    } catch (err) {
      alert('Failed to clear cache');
    }
  };

  const handleReindex = async () => {
    try {
      await searchAPI.reindexAll();
      alert('Reindexing started in background');
    } catch (err) {
      alert('Failed to start reindexing');
    }
  };

  const containerStyle = {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const headerStyle = {
    marginBottom: '24px'
  };

  const titleStyle = {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: '8px'
  };

  const subtitleStyle = {
    color: '#666',
    fontSize: '14px'
  };

  const tabsContainerStyle = {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    flexWrap: 'wrap',
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '8px'
  };

  const tabStyle = (isActive) => ({
    padding: '10px 20px',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    backgroundColor: isActive ? '#3b82f6' : 'transparent',
    color: isActive ? 'white' : '#666',
    transition: 'all 0.2s'
  });

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb'
  };

  const cardTitleStyle = {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#1a1a2e'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px'
  };

  const statusBadgeStyle = (status) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: status === 'healthy' ? '#dcfce7' : status === 'degraded' ? '#fef3c7' : '#fee2e2',
    color: status === 'healthy' ? '#166534' : status === 'degraded' ? '#92400e' : '#dc2626'
  });

  const buttonStyle = {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px'
  };

  const inputStyle = {
    padding: '10px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '300px'
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  };

  const thStyle = {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '2px solid #e5e7eb',
    color: '#666',
    fontWeight: '600'
  };

  const tdStyle = {
    padding: '12px',
    borderBottom: '1px solid #e5e7eb'
  };

  const metricCardStyle = {
    backgroundColor: '#f8fafc',
    padding: '16px',
    borderRadius: '8px',
    textAlign: 'center'
  };

  const metricValueStyle = {
    fontSize: '28px',
    fontWeight: '700',
    color: '#3b82f6'
  };

  const metricLabelStyle = {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>🖥️ System Dashboard</h1>
        <p style={subtitleStyle}>Monitor all system components and services</p>
      </div>

      <div style={tabsContainerStyle}>
        {[
          { id: 'status', label: '📊 System Status' },
          { id: 'search', label: '🔍 Search (ES)' },
          { id: 'cache', label: '⚡ Cache (Redis)' },
          { id: 'analytics', label: '📈 Analytics' },
          { id: 'audit', label: '📝 Audit Logs' },
          { id: 'quality', label: '✅ Data Quality' }
        ].map(tab => (
          <button
            key={tab.id}
            style={tabStyle(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ ...cardStyle, backgroundColor: '#fee2e2', color: '#dc2626' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '16px', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* System Status Tab */}
      {activeTab === 'status' && systemStatus && (
        <div>
          <div style={cardStyle}>
            <div style={cardTitleStyle}>
              Overall Status: <span style={statusBadgeStyle(systemStatus.overall)}>{systemStatus.overall?.toUpperCase()}</span>
            </div>
            <div style={gridStyle}>
              {Object.entries(systemStatus).filter(([key]) => key !== 'overall').map(([service, info]) => (
                <div key={service} style={metricCardStyle}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>{service}</div>
                  <span style={statusBadgeStyle(info.status)}>{info.status}</span>
                  {info.error && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>{info.error}</div>}
                  {info.version && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>v{info.version}</div>}
                </div>
              ))}
            </div>
          </div>
          <button style={buttonStyle} onClick={loadSystemStatus}>🔄 Refresh Status</button>
        </div>
      )}

      {/* Search Tab (Elasticsearch) */}
      {activeTab === 'search' && (
        <div>
          <div style={cardStyle}>
            <div style={cardTitleStyle}>🔍 Elasticsearch Full-Text Search</div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                style={inputStyle}
              />
              <button style={buttonStyle} onClick={handleSearch}>Search</button>
              <button style={{ ...buttonStyle, backgroundColor: '#10b981' }} onClick={handleReindex}>
                Reindex All Events
              </button>
            </div>

            {searchResults && (
              <div>
                <div style={{ marginBottom: '12px', color: '#666' }}>
                  Found {searchResults.total || searchResults.results?.length || 0} results
                </div>
                {searchResults.results?.map(result => (
                  <div key={result.id} style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: '600' }}>{result.title}</div>
                    <div style={{ fontSize: '13px', color: '#666' }}>{result.description}</div>
                    <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px' }}>
                      📍 {result.location} | 🏷️ {result.category} | Score: {result.score?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cache Tab (Redis) */}
      {activeTab === 'cache' && (
        <div>
          <div style={cardStyle}>
            <div style={cardTitleStyle}>⚡ Redis Cache Statistics</div>
            {cacheStats?.available === false ? (
              <div style={{ color: '#dc2626' }}>Redis is not available: {cacheStats.error || cacheStats.message}</div>
            ) : cacheStats ? (
              <div>
                <div style={gridStyle}>
                  <div style={metricCardStyle}>
                    <div style={metricValueStyle}>{cacheStats.total_keys || 0}</div>
                    <div style={metricLabelStyle}>Total Keys</div>
                  </div>
                  <div style={metricCardStyle}>
                    <div style={metricValueStyle}>{cacheStats.used_memory || 'N/A'}</div>
                    <div style={metricLabelStyle}>Memory Used</div>
                  </div>
                  <div style={metricCardStyle}>
                    <div style={metricValueStyle}>{cacheStats.hits || 0}</div>
                    <div style={metricLabelStyle}>Cache Hits</div>
                  </div>
                  <div style={metricCardStyle}>
                    <div style={metricValueStyle}>{cacheStats.hit_rate || 0}%</div>
                    <div style={metricLabelStyle}>Hit Rate</div>
                  </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <button style={{ ...buttonStyle, backgroundColor: '#ef4444' }} onClick={handleClearCache}>
                    🗑️ Clear All Cache
                  </button>
                </div>
              </div>
            ) : (
              <div>Loading...</div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div>
          {analytics && (
            <div style={cardStyle}>
              <div style={cardTitleStyle}>📈 Analytics Overview</div>
              <div style={gridStyle}>
                <div style={metricCardStyle}>
                  <div style={metricValueStyle}>{analytics.overview?.total_events || 0}</div>
                  <div style={metricLabelStyle}>Total Events</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricValueStyle}>{analytics.overview?.total_participants || 0}</div>
                  <div style={metricLabelStyle}>Total Participants</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricValueStyle}>{analytics.overview?.check_in_rate || 0}%</div>
                  <div style={metricLabelStyle}>Check-in Rate</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricValueStyle}>{analytics.fill_rate?.average || 0}%</div>
                  <div style={metricLabelStyle}>Avg Fill Rate</div>
                </div>
              </div>
            </div>
          )}

          {analytics?.categories && (
            <div style={cardStyle}>
              <div style={cardTitleStyle}>📊 Category Distribution</div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {Object.entries(analytics.categories).map(([cat, count]) => (
                  <div key={cat} style={{ padding: '8px 16px', backgroundColor: '#e0e7ff', borderRadius: '20px', fontSize: '14px' }}>
                    {cat}: <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {clustering?.clusters?.length > 0 && (
            <div style={cardStyle}>
              <div style={cardTitleStyle}>🎯 K-Means Clustering</div>
              <div style={gridStyle}>
                {clustering.clusters.map(cluster => (
                  <div key={cluster.cluster_id} style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Cluster {cluster.cluster_id}</div>
                    {cluster.events.map(event => (
                      <div key={event.id} style={{ fontSize: '13px', padding: '4px 0' }}>
                        {event.title} - {event.fill_rate?.toFixed(1)}% filled
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {anomalies?.anomalies?.length > 0 && (
            <div style={cardStyle}>
              <div style={cardTitleStyle}>⚠️ Anomalies Detected ({anomalies.anomaly_count})</div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Event</th>
                    <th style={thStyle}>Fill Rate</th>
                    <th style={thStyle}>Z-Score</th>
                    <th style={thStyle}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.anomalies.map(a => (
                    <tr key={a.event_id}>
                      <td style={tdStyle}>{a.title}</td>
                      <td style={tdStyle}>{a.fill_rate}%</td>
                      <td style={tdStyle}>{a.z_score}</td>
                      <td style={tdStyle}>
                        <span style={statusBadgeStyle(a.reason === 'unusually_high' ? 'degraded' : 'unhealthy')}>
                          {a.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div>
          {auditVerification && (
            <div style={{ ...cardStyle, backgroundColor: auditVerification.valid ? '#dcfce7' : '#fee2e2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>{auditVerification.valid ? '✅' : '❌'}</span>
                <div>
                  <div style={{ fontWeight: '600' }}>Hash Chain Verification</div>
                  <div style={{ fontSize: '13px' }}>{auditVerification.message} | Verified: {auditVerification.verified} entries</div>
                </div>
              </div>
            </div>
          )}

          <div style={cardStyle}>
            <div style={cardTitleStyle}>📝 Recent Audit Logs</div>
            {auditLogs?.logs?.length > 0 ? (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Time</th>
                    <th style={thStyle}>Action</th>
                    <th style={thStyle}>Entity</th>
                    <th style={thStyle}>User</th>
                    <th style={thStyle}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.logs.map(log => (
                    <tr key={log.id}>
                      <td style={tdStyle}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={tdStyle}><span style={statusBadgeStyle('healthy')}>{log.action}</span></td>
                      <td style={tdStyle}>{log.entity_type} #{log.entity_id}</td>
                      <td style={tdStyle}>{log.user_email || 'System'}</td>
                      <td style={tdStyle}>{log.details || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No audit logs found</div>
            )}
          </div>
        </div>
      )}

      {/* Data Quality Tab */}
      {activeTab === 'quality' && dataQuality && (
        <div>
          <div style={cardStyle}>
            <div style={cardTitleStyle}>✅ Data Quality Score</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ ...metricCardStyle, minWidth: '150px' }}>
                <div style={{ ...metricValueStyle, color: dataQuality.quality_score > 80 ? '#10b981' : dataQuality.quality_score > 50 ? '#f59e0b' : '#ef4444' }}>
                  {dataQuality.quality_score}%
                </div>
                <div style={metricLabelStyle}>Quality Score</div>
              </div>
              <div>
                <div style={{ marginBottom: '8px' }}>
                  Events checked: <strong>{dataQuality.entities_checked?.events || 0}</strong>
                </div>
                <div>
                  Participants checked: <strong>{dataQuality.entities_checked?.participants || 0}</strong>
                </div>
              </div>
            </div>
          </div>

          {dataQuality.issues?.length > 0 && (
            <div style={cardStyle}>
              <div style={cardTitleStyle}>⚠️ Issues Found ({dataQuality.total_issues})</div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Entity</th>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {dataQuality.issues.map((issue, idx) => (
                    <tr key={idx}>
                      <td style={tdStyle}>
                        <span style={statusBadgeStyle('degraded')}>{issue.type}</span>
                      </td>
                      <td style={tdStyle}>{issue.entity}</td>
                      <td style={tdStyle}>{issue.id}</td>
                      <td style={tdStyle}>{issue.title || issue.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dataQuality.issues?.length === 0 && (
            <div style={{ ...cardStyle, backgroundColor: '#dcfce7', textAlign: 'center' }}>
              <span style={{ fontSize: '48px' }}>🎉</span>
              <div style={{ fontWeight: '600', marginTop: '8px' }}>No data quality issues found!</div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Loading...
        </div>
      )}
    </div>
  );
};

export default SystemDashboard;
