// src/services/queueService.js
class ProcessingQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = options.maxConcurrent || 1;
    this.currentlyProcessing = 0;
    this.processed = 0;
    this.failed = 0;
    
    // NOVO: Configurações de gerenciamento de recursos
    this.processingDelay = options.processingDelay || 0; // Pausa entre itens (ms)
    this.maxRetries = options.maxRetries || 2; // Máximo de tentativas por item
    this.maxQueueSize = options.maxQueueSize || 100; // Limite de tamanho da fila
    
    // Status para monitoramento
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      averageTime: 0,
      lastProcessed: null,
      // NOVO: Métricas avançadas
      peakQueueSize: 0,
      totalItems: 0,
      memoryBeforeProcessing: 0,
      memoryAfterProcessing: 0
    };
  }
  
  // Adicionar tarefa à fila
  add(task, options = {}) {
    return new Promise((resolve, reject) => {
      // NOVO: Verificar limite da fila
      if (this.queue.length >= this.maxQueueSize) {
        const error = new Error(`Queue limit reached (${this.maxQueueSize} items). Try again later.`);
        console.warn(`📋 Queue: Rejected task - ${error.message}`);
        return reject(error);
      }
      
      const queueItem = {
        id: Date.now() + Math.random(),
        task,
        resolve,
        reject,
        priority: options.priority || 0,
        addedAt: Date.now(),
        timeout: options.timeout || 30000, // 30 segundos default
        // NOVO: Controle de retry
        attempts: 0,
        maxRetries: options.maxRetries || this.maxRetries
      };
      
      // Adicionar respeitando prioridade
      if (options.priority > 0) {
        // Inserir no início para alta prioridade
        this.queue.unshift(queueItem);
      } else {
        // Adicionar no final para prioridade normal
        this.queue.push(queueItem);
      }
      
      // NOVO: Atualizar métricas
      this.stats.totalItems++;
      this.stats.peakQueueSize = Math.max(this.stats.peakQueueSize, this.queue.length);
      
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
    
    // NOVO: Registrar uso de memória antes do processamento
    this.stats.memoryBeforeProcessing = process.memoryUsage().heapUsed;
    
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
      
      // NOVO: Registrar uso de memória após o processamento
      this.stats.memoryAfterProcessing = process.memoryUsage().heapUsed;
      
      // Calcular diferença de memória
      const memoryChange = this.stats.memoryAfterProcessing - this.stats.memoryBeforeProcessing;
      const memoryChangeMB = Math.round(memoryChange / 1024 / 1024 * 100) / 100;
      
      // Atualizar estatísticas
      this.stats.totalProcessed++;
      this.stats.lastProcessed = new Date();
      this.stats.averageTime = 
        (this.stats.averageTime * (this.stats.totalProcessed - 1) + processingTime) / 
        this.stats.totalProcessed;
      
      // Log mais informativo
      console.log(`✅ Queue: Task ${queueItem.id} completed in ${processingTime}ms (Memory ${memoryChangeMB > 0 ? '+' : ''}${memoryChangeMB}MB)`);
      queueItem.resolve(result);
      
    } catch (error) {
      // NOVO: Implementar lógica de retry
      queueItem.attempts++;
      
      if (queueItem.attempts <= queueItem.maxRetries) {
        console.warn(`⚠️ Queue: Task ${queueItem.id} failed (attempt ${queueItem.attempts}/${queueItem.maxRetries}). Retrying...`);
        // Colocar de volta na fila com prioridade aumentada
        this.queue.unshift({
          ...queueItem,
          priority: queueItem.priority + 1 // Aumentar prioridade para próxima tentativa
        });
      } else {
        this.stats.totalFailed++;
        console.error(`❌ Queue: Task ${queueItem.id} failed after ${queueItem.attempts} attempts:`, error.message);
        queueItem.reject(error);
      }
    } finally {
      this.currentlyProcessing--;
      
      // NOVO: Adicionar delay opcional entre processamentos
      if (this.processingDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.processingDelay));
      }
      
      // Continuar processando se há mais tarefas
      if (this.queue.length > 0) {
        this.process();
      } else {
        this.processing = false;
        // NOVO: Sugerir liberação de memória
        if (this.stats.memoryAfterProcessing > 100 * 1024 * 1024) { // > 100MB
          console.log('🧹 Queue empty. Suggesting garbage collection.');
          if (global.gc) global.gc();
        }
      }
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

// Criar filas específicas - OTIMIZADAS
const imageQueue = new ProcessingQueue({ 
  maxConcurrent: 1,      // Reduzir para apenas 1 concorrente
  processingDelay: 100,  // Adicionar pequeno delay entre itens
  maxQueueSize: 50       // Limite de 50 itens na fila de imagens
});

const emailQueue = new ProcessingQueue({ 
  maxConcurrent: 1,      // Reduzir de 2 para 1
  maxQueueSize: 100
});

const fileQueue = new ProcessingQueue({ 
  maxConcurrent: 1, 
  processingDelay: 200,  // Adicionar delay maior para operações de arquivo
  maxQueueSize: 50
});

module.exports = {
  ProcessingQueue,
  imageQueue,
  emailQueue,
  fileQueue
};