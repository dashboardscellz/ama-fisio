// Configuração pública do site AMA FISIO, projeto Firebase criado pela administradora.
// Não coloque aqui senha, chave privada nem dados de pacientes.
window.AMA_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyBGOtf077aDG-XAHn_5pGC9oM2lssIYJK8',
    authDomain: 'ama-fisio.firebaseapp.com',
    databaseURL: 'https://ama-fisio-default-rtdb.firebaseio.com',
    projectId: 'ama-fisio',
    appId: '1:1035950295019:web:11d503c276111f6d637bae',
    storageBucket: 'ama-fisio.firebasestorage.app',
    messagingSenderId: '1035950295019',
    measurementId: 'G-7Z5W02X636'
  },
  masterUsername: 'Amanda Marinho',
  // Conta cadastrada no Firebase Authentication; usada internamente no login.
  // Amanda informa apenas seu nome de usuario na tela do site.
  internalAuthId: 'manasses.medstar@gmail.com',
  // UID da conta mestre autorizada nas regras do Firestore.
  masterUid: 'yBUz70Z0iSWkyxFB65tfkmS8Wfk1',
  demoEnabled: false
};
