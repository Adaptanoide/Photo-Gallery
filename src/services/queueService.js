// src/services/queueService.js
class ProcessingQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = options.maxConcurrent || 1;
    this.currentlyProcessing = 0;
    this.processed = 0;
    this.failed = 0;
    
    // Status para monitoramento
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      averageTime: 0,
      lastProcessed: null
    };
  }
  
  // Adicionar tarefa à fila
  add(task, options = {}) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        id: Date.now() + Math.random(),
        task,
        resolve,
        reject,
        priority: options.priority || 0,
        addedAt: Date.now(),
        timeout: options.timeout || 30000 // 30 segundos default
      };
      
      // Adicionar respeitando prioridade
      if (options.priority > 0) {
        // Inserir no início para alta prioridade
        this.queue.unshift(queueItem);
      } else {
        // Adicionar no final para prioridade normal
        this.queue.push(queueItem);
      }
      
      console.log(`📋 Queue: Added task ${queueItem.id} (${this.queue.length} in queue)`);
      
      // Iniciar processamento se não estiver rodando
      this.process();
    });
  }
  
  // Processar fila
  async process() {
    // Verificar se já estamos processando o máximo
    if (this.currentlyProcessing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    this.currentlyProcessing++;
    
    const queueItem = this.queue.shift();
    const startTime = Date.now();
    
    console.log(`⚡ Queue: Processing task ${queueItem.id}...`);
    
    try {
      // Configurar timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Task timeout')), queueItem.timeout)
      );
      
      // Executar tarefa com timeout
      const result = await Promise.race([
        queueItem.task(),
        timeoutPromise
      ]);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Atualizar estatísticas
      this.stats.totalProcessed++;
      this.stats.lastProcessed = new Date();
      this.stats.averageTime = 
        (this.stats.averageTime * (this.stats.totalProcessed - 1) + processingTime) / 
        this.stats.totalProcessed;
      
      console.log(`✅ Queue: Task ${queueItem.id} completed in ${processingTime}ms`);
      queueItem.resolve(result);
      
    } catch (error) {
      this.stats.totalFailed++;
      console.error(`❌ Queue: Task ${queueItem.id} failed:`, error.message);
      queueItem.reject(error);
    } finally {
      this.currentlyProcessing--;
      
      // Pequena pausa para não sobrecarregar
      setTimeout(() => {
        // Continuar processando se há mais tarefas
        if (this.queue.length > 0) {
          this.process();
        } else {
          this.processing = false;
        }
      }, 100);
    }
  }
  
  // Status da fila
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.currentlyProcessing,
      maxConcurrent: this.maxConcurrent,
      stats: this.stats
    };
  }
  
  // Limpar fila
  clear() {
    // Rejeitar todas as tarefas pendentes
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    
    this.queue = [];
    console.log('🗑️ Queue: Cleared all pending tasks');
  }
}

// Criar filas específicas
const imageQueue = new ProcessingQueue({ maxConcurrent: 1 });
const emailQueue = new ProcessingQueue({ maxConcurrent: 2 });
const fileQueue = new ProcessingQueue({ maxConcurrent: 1 });

module.exports = {
  ProcessingQueue,
  imageQueue,
  emailQueue,
  fileQueue
};