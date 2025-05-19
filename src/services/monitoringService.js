// src/services/monitoringService.js
const os = require('os');
const fs = require('fs');
const path = require('path');

class MonitoringService {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      memoryPeaks: [],
      cpuHistory: [],
      cacheStats: []
    };
    
    this.alerts = {
      memoryThreshold: 20 * 1024 * 1024 * 1024, // 20GB limite
      cpuThreshold: 80, // 80% CPU
      diskThreshold: 90 // 90% disco
    };
    
    // Iniciar monitoramento automático
    this.startMonitoring();
  }
  
  startMonitoring() {
    // Monitoramento a cada 5 minutos
    setInterval(() => {
      this.collectMetrics();
    }, 5 * 60 * 1000);
    
    // Log de status a cada 30 minutos
    setInterval(() => {
      this.logStatus();
    }, 30 * 60 * 1000);
    
    // Verificar alertas a cada minuto
    setInterval(() => {
      this.checkAlerts();
    }, 60 * 1000);
    
    console.log('📊 Monitoring service started');
  }
  
  collectMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    
    // Memória
    const currentMemory = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      systemFree: os.freemem(),
      systemTotal: os.totalmem()
    };
    
    // CPU (será aproximado)
    const currentCpu = {
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system,
      loadAverage: os.loadavg()
    };
    
    // Manter apenas últimas 100 medições
    this.metrics.memoryPeaks.push(currentMemory);
    this.metrics.cpuHistory.push(currentCpu);
    
    if (this.metrics.memoryPeaks.length > 100) {
      this.metrics.memoryPeaks.shift();
    }
    
    if (this.metrics.cpuHistory.length > 100) {
      this.metrics.cpuHistory.shift();
    }
  }
  
  logStatus() {
    const currentMem = process.memoryUsage();
    const uptime = process.uptime();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    
    console.log('\n=== 📊 SYSTEM STATUS ===');
    console.log(`⏱️  Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`);
    console.log(`📝 Requests: ${this.metrics.requests} | Errors: ${this.metrics.errors}`);
    console.log(`🧠 Memory Used: ${Math.round(currentMem.heapUsed / 1024 / 1024)}MB`);
    console.log(`💾 System Memory: ${Math.round((totalMem - freeMem) / 1024 / 1024)}MB / ${Math.round(totalMem / 1024 / 1024)}MB`);
    console.log(`💿 Load Average: ${os.loadavg().map(x => x.toFixed(2)).join(', ')}`);
    console.log('========================\n');
  }
  
  checkAlerts() {
    const currentMem = process.memoryUsage();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memUsagePercent = ((totalMem - freeMem) / totalMem) * 100;
    
    // Alerta de memória
    if (currentMem.heapUsed > this.alerts.memoryThreshold) {
      console.warn('🚨 ALERT: High memory usage!', {
        current: Math.round(currentMem.heapUsed / 1024 / 1024) + 'MB',
        threshold: Math.round(this.alerts.memoryThreshold / 1024 / 1024) + 'MB'
      });
    }
    
    // Alerta de memória do sistema
    if (memUsagePercent > 85) {
      console.warn('🚨 ALERT: System memory usage high!', {
        percentage: memUsagePercent.toFixed(1) + '%',
        free: Math.round(freeMem / 1024 / 1024) + 'MB'
      });
    }
    
    // Verificar espaço em disco
    this.checkDiskSpace();
  }
  
  checkDiskSpace() {
    try {
      const cacheDir = path.join(__dirname, '../../cache');
      const stats = fs.statSync(cacheDir);
      
      // Nota: Esta é uma verificação básica
      // Para uma verificação real de disco, seria necessário usar bibliotecas específicas
      
    } catch (error) {
      // Cache dir pode não existir ainda
    }
  }
  
  // Contar requisição
  countRequest() {
    this.metrics.requests++;
  }
  
  // Contar erro
  countError() {
    this.metrics.errors++;
  }
  
  // Adicionar estatísticas de cache
  addCacheStats(stats) {
    this.metrics.cacheStats.push({
      timestamp: Date.now(),
      ...stats
    });
    
    // Manter apenas últimas 50 medições
    if (this.metrics.cacheStats.length > 50) {
      this.metrics.cacheStats.shift();
    }
  }
  
  // Obter status atual
  getStatus() {
    const currentMem = process.memoryUsage();
    const uptime = process.uptime();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    
    return {
      uptime: {
        seconds: uptime,
        formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
      },
      memory: {
        heap: {
          used: Math.round(currentMem.heapUsed / 1024 / 1024),
          total: Math.round(currentMem.heapTotal / 1024 / 1024)
        },
        system: {
          free: Math.round(freeMem / 1024 / 1024),
          total: Math.round(totalMem / 1024 / 1024),
          usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100)
        }
      },
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      errorRate: this.metrics.requests > 0 ? 
        (this.metrics.errors / this.metrics.requests * 100).toFixed(2) : 0,
      loadAverage: os.loadavg().map(x => x.toFixed(2))
    };
  }
  
  // Reset das métricas
  reset() {
    this.metrics = {
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      memoryPeaks: [],
      cpuHistory: [],
      cacheStats: []
    };
    console.log('📊 Monitoring metrics reset');
  }
}

// Singleton
const monitoringService = new MonitoringService();
module.exports = monitoringService;