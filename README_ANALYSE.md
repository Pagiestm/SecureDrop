# Analyse de la solution SecureDrop

## 3. Analyse des coûts

Le déploiement d'une architecture Cloud-Native repose fondamentalement sur le modèle de tarification à l'usage (*Pay-as-you-go*, tel que le plan Blaze de Firebase/GCP). Si ce modèle est redoutable d'efficacité pour amorcer un projet sans investissement initial (Zéro Capex), il nécessite une gouvernance stricte (Opex).

### Les principales sources de coût
Dans notre topologie actuelle, les centres de coûts se répartissent ainsi :
*   **Firebase Storage (Google Cloud Storage)** : Il constitue probablement la charge la plus importante. La facturation englobe non seulement le volume total de données stockées au repos (Go/mois), mais surtout la **bande passante sortante** (*Egress*), c'est-à-dire le volume de données téléchargées par le biais des liens partagés.
*   **Cloud Functions (Serverless)** : La puissance de calcul à la demande a un prix. La facturation est induite par le nombre d'invocations brutes, le temps d'exécution (en millisecondes), ainsi que par les ressources matérielles allouées (couple CPU/RAM).
*   **Firestore (Base de données NoSQL)** : La particularité de Firestore réside dans la facturation détaillée à l'opération de lecture, d'écriture et de suppression. L'espace de stockage pur des documents (métadonnées, logs) et de leurs index s'ajoute à cette facture dynamique.
*   **Firebase Authentication** : Bien que généreux (gratuit pour les authentifications standards par email/mot de passe), ce service deviendra payant dès l'inévitable implémentation du MFA (Multi-Factor Authentication) par SMS pour en durcir la sécurité.

### Les risques inhérents de dérive (Surcoûts)
L'absence de serveurs dédiés plafonnés expose le système à des pics de facturation incontrôlés :
*   **Attaques DDoS et hémorragie de bande passante** : La libre distribution de liens de téléchargement expose à un risque majeur. Un attaquant automatisant des centaines de milliers de requêtes vers le flux de téléchargement d'un fichier volumineux fera grimper la facture de réseau sortant ainsi que le temps d'exécution des Cloud Functions.
*   **Emballement algorithmique (Infinite Loops)** : Les triggers de base de données (tels que notre fonction `onWrite` gérant l'audit) sont redoutables. Si un trigger mal optimisé écoute et écrit sur une même collection sans condition stricte de sortie, cela engendre une boucle d'écriture infinie, vidant un budget Cloud en quelques heures.
*   **Lectures excessives et non-optimisées** : Si l'application frontend requiert le chargement complet de l'historique d'un utilisateur à chaque connexion sans pagination (*Lazy Loading*), le coût de lecture de Firestore croît de manière exponentielle avec la rétention des utilisateurs (problème du N+1 query).

### Pistes concrètes d'optimisation
Pour pérenniser le produit, plusieurs barrières de protection doivent être misent en place :
*   **Validation des flux via Firebase App Check** : C'est le premier rempart. App Check atteste que les requêtes proviennent exclusivement de l'application cliente officielle de *SecureDrop*, neutralisant ainsi les scripts malveillants avant même qu'ils ne sollicitent le backend facturable.
*   **Mise en place de garde-fous budgétaires** : Configurer Google Cloud Billing pour déclencher des alertes par palier (et l'interruption préventive des services via Webhook) est vital pour éviter la « faillite serveur ».
*   **Stratégies de compression et de mise en cache** : Il conviendra de compresser drastiquement les données côté client (navigateur) avant l'upload pour réduire le poids au repos. En parallèle, utiliser un réseau de diffusion de contenu (CDN) limitera les appels directs à la base de données.

## 4. Analyse critique

### Les limites techniques de l'architecture
*   **Le fléau des *Cold Starts*** : La philosophie du Serverless est de détruire les instances inactives. Conséquence : lorsqu'un utilisateur sollicite une Cloud Function restée dormante (ex. la fonction `createShareLink`), l'infrastructure doit provisionner à chaud un environnement d'exécution, générant une latence initiale très perceptible pouvant dégrader l'expérience utilisateur.
*   **Le goulot d'étranglement des fichiers volumineux** : Transférer de lourds fichiers binaires (plusieurs gigaoctets) *à travers* une Cloud Function (notre route `downloadSharedFile`) est une erreur de conception à grande échelle. Le runtime d'une fonction n'est ni pensé ni optimisé pour le transfert prolongé ; la fonction frappera rapidement sa limite de temps d'exécution (Timeout) ou sa limite absolue de RAM, entrainant le crash du téléchargement.
*   **Les quotas d'écriture Firestore** : Firestore impose une limite dure d'environ une écriture par seconde sur un document précis. Cela le disqualifie complètement en tant que compteur de téléchargement en temps réel agissant sur un seul document global.

### Les axes d'amélioration
*   **Mise en œuvre native des *Signed URLs*** : La refonte la plus urgente concernant les téléchargements est de contourner les Cloud Functions via les URL Signées Google Cloud Storage. La fonction ne renverrait plus qu'un "laissez-passer" (l'URL Signée limitée dans le temps) et le visiteur téléchargerait directement le flux binaire depuis les serveurs de stockage natifs de Google, éliminant les pannes mémoires et réduisant la consommation de calcul.
*   **Chiffrement asymétrique de bout en bout (E2EE)** : Actuellement, Google (et nos potentiels administrateurs système) détiennent un accès lisible aux fichiers hébergés au sein de notre Storage. Il conviendra d'implémenter un chiffrement par clé publique côté Frontend (Web Crypto API) afin que le serveur ne manipule qu'une donnée cryptographiquement morte sans détenir la clé privée.

### Le péril de la dépendance au cloud (Lock-in)
*   **L'illusion de l'agnosticisme** : Le projet SecureDrop est actuellement otage de Google. C'est ce qu'on appelle un **Vendor Lock-in** extrêmement fort.
*   Le routage de la sécurité ne s'opère pas via des modèles de conception standards, mais via un langage propre à Google (`firestore.rules` et `storage.rules`). 
*   Quitter GCP pour s'orienter vers une infrastructure hébergée (On-Premise) ou vers un concurrent (AWS, Azure) n'impliquerait pas une simple migration, mais une pure et simple réécriture de toute la brique d'authentification, de gestion de fichiers et des modèles de données NoSQL.

## 5. Dimension Big Data

### Le concept du Pipeline de Données
Afin de rendre ces millions d'actions de partage analysables, le trajet de la donnée s'échelonnera de l'ingestion jusqu'à la restitution structurée métier :
1.  **Ingestion** : À chaque interaction (upload, création de lien), plutôt que d'écrire en direct dans Firestore, un service de messagerie massive (tel que **Google Cloud Pub/Sub**) intercepte et absorbe les requêtes volatiles pour encaisser les pics de trafic.
2.  **Stockage du format source** : Les messages atterrissent dans leur forme brute JSON (ou Apache Avro/Parquet) au cœur de "Bacs virtuels" hébergés sur Google Cloud Storage. 
3.  **Traitement et Transformation (ETL/ELT)** : De puissants workers (comme **Cloud Dataflow**) récupèrent ces données sales, les épurent, en effacent la casse erratiques, et les enrichissent de méta-valeurs (comme retrouver la position géographique des adresses IP en fraude).
4.  **Analyse et Visualisation** : L'or noir, désormais affiné, est massivement injecté dans **BigQuery** (notre machine d'analyse analytique textuelle très véloces). Il sert directement de base aux requêtes SQL poussant la Data-Viz via **Looker Studio** à disposition de l'équipe métier de *SecureDrop*.

### La dualité des traitements : Batch vs Streaming
Traiter la donnée comporte deux urgences bien distinctes :
*   **Traitements en Streaming (Le Temps Réel)** : L'analyse du comportement réseau ne souffre d'aucun délai (Cyber sécurité dynamique).
    *   *Cas d'usage :* Si l'architecture repère un pic insolite tel qu'un compte anonyme extrayant plus de 50 Go d'archives étalées sur les dernières secondes, ou amorçant plus de 1000 créations de lien de partage minute, le Streaming l'isole par analyse instantanée via des fenêtres glissantes de calcul pour invalider son Token Auth immédiatement.
    *   *Justification :* Les risques de brèche de sécurité ou le piratage nécessitent une frappe de réaction se comptant en millisecondes pour sauver les données et l'exposition financière du service.
*   **Traitements en Batch (Le Différé Planifié)** : 
    *   *Cas d'usage :* Durant des créneaux nocturnes calmes (par ex: 2h00 du matin), une routine Big Data s'active. Elle recalcule la moyenne d'occupation totale de stockage des abonnés Premium, épure des logs anciens qui passent aux pétaoctets, et extrait les tables de comptabilité en prévision de la facturation.
    *   *Justification :* Il n'y a nulle valeur business inhérente à déterminer un quota financier par la réactivité de la nanoseconde. Les calculs structurants traitant de milliards de colonnes doivent être gérés de façon asynchrone et économique (Batch), en lots massifs.

### Le clivage stratégique : Data Lake vs Data Warehouse
*   **Le Data Lake (Le Lac de Données - ex: Cloud Storage)** : Il accumule sans préjuger la donnée originelle dans son aspect inerte (logs, extraits de comportements, fichiers techniques).
    *   *Son Rôle* : Véritable archive glaciaire, son coût de conservation y est dérisoire. C’est la pierre angulaire conservatrice garantissant l'accès des pétaoctets de logs bruts pour répondre indifféremment à de futures enquêtes pénales, des algorithmes d'IA non-conçus encore à ce jour, ou bien procéder à de nouvelles extractions en différés (Replays).
*   **Le Data Warehouse (L'Entrepôt de Données - ex: Google BigQuery)** : Il recueille de l'information filtrée, uniformisée et hyper-indexée, reflétant les règles métiers.
    *   *Son Rôle* : C'est la vitrine relationnelle des données offrant aux analystes et data scientists la possibilité de croiser d'incroyables métriques, via de simples requêtes SQL, en quelques fractions de seconde, propulsant le suivi d'objectifs (KPIs).

### Synthèse Globale : Le pacte Architecture Lambda
**Choix décisif adopté : L'Architecture Lambda.**

*Justification de ce modèle :*
L'Architecture Lambda repose sur un principe fondateur fort : la séparation explicite en deux branches. Une ramification extrêmement rapide nommée la **Speed Layer** (dédiée au Streaming), conjuguée à une branche capable de la plus profonde robustesse appelée la **Batch Layer**, les deux filières coalesçant sur le front de la **Serving Layer** qui harmonise tout pour le spectateur.

Pour un écosystème comme *SecureDrop* combinant échanges en temps réel et stockage durable, refuser l'une de ces branches serait irréaliste :
1.  Nous imposons une **Speed Layer** pour l'alerte immédiate (Anxiété de la bande passante, blocages anti-DDoS, notifications de partages illégaux).
2.  Nous présidons à une **Batch Layer** pour refaçonner historiquement de fond en comble nos facturations mensuelles au calme durant les routines nocturnes en traitant des pétaoctets reposés. 

Le parti pris concurrent de l'Architecture Kappa (tout par le streaming, tout le temps) serait ici inadapté : l'inflexibilité concernant les reprises analytiques massives rendrait la simple émission asynchrone des rapports comptables inutilement complexe à opérer en flux tendu. Le modèle Lambda encadre notre plateforme souverainement, lui offrant la dextérité du temps réel et la gravité pragmatique de l'historique de masse.
