import { Injectable } from "@angular/core";

import { Layout, LiteEvent } from "./model";

// Used to initialize the application during bootstrap, including resolving VSS services so that they
// can be injected in the constructors of other services.
// This is the only class that should be interacting with the VSS module.
@Injectable()
export class AppConfigService {

    // Set this to true to develop & test locally
    private _devMode: boolean = false;
    // change this to the endpoint of the tfs service that you wish to develop against
    private _devApiEndpoint: string = "http://<host>:8080/tfs/DefaultCollection";
    // change this to the default project to filter to if all projects is not selected
    private _devDefaultProject: string = "MyFirstProject";

    private _gitClientFactory: GitClientFactory;
    private _identitiesClientFactory: IdentitiesClientFactory;
    private _context: Context;
    private _extensionDataService: IExtensionDataService;
    private _layout: Layout = {
      categories: [{
        key: "requestedByMe", name: "Requested By Me"
      },
      {
        key: "assignedToMe", name: "Assigned To Me"
      },
      {
        key: "assignedToMyTeam", name: "Assigned To My Team"
      }],
      widgetMode: false
    };

    private _layoutChanged = new LiteEvent<Layout>();

    get devMode(): boolean { return this._devMode; }
    get devApiEndpoint(): string { return this._devApiEndpoint; }
    get devDefaultProject(): string { return this._devDefaultProject; }

    get gitClientFactory(): GitClientFactory { return this._gitClientFactory; }
    get identitiesClientFactory(): IdentitiesClientFactory { return this._identitiesClientFactory; }
    get context(): Context { return this._context; }
    get extensionDataService(): IExtensionDataService { return this._extensionDataService; }
    get layout(): Layout { return this._layout; }
    get layoutChanged() { return this._layoutChanged.expose(); }

    public initialize(): Promise<boolean> {
      return new Promise<boolean>((resolve, reject) => {

        // don't do any of the VSS init when in dev mode
        if (this._devMode) {
          resolve(true);
          return;
        }

        VSS.init({
            usePlatformScripts: false,
            usePlatformStyles: false,
            explicitNotifyLoaded: true
        });

        VSS.require(["TFS/VersionControl/GitRestClient", "VSS/Identities/RestClient", "VSS/Context", "TFS/Dashboards/WidgetHelpers"],
          (gitFactory: GitClientFactory, identityFactory: IdentitiesClientFactory, context: Context, widgetHelpers: any) => {
              this._gitClientFactory = gitFactory;
              this._identitiesClientFactory = identityFactory;
              this._context = context;
              this._layout.widgetMode = context.getPageContext().navigation.currentController === "dashboards";
              VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData)
                  .then((service) => {
                      this._extensionDataService = service;
                      if (this._layout.widgetMode) {
                        widgetHelpers.IncludeWidgetStyles();
                        VSS.register("tfs-pullrequest-dashboard-widget", () => {
                          return {
                            load: (settings) => {
                              if (settings.customSettings.data) {
                                  const s = JSON.parse(settings.customSettings.data);
                                  if (s && s.prCategory) {
                                      this._layout.categories = [{
                                        key: s.prCategory,
                                        name: settings.name
                                      }];
                                  } else {
                                    this._layout.categories = [{
                                        key: "assignedToMe",
                                        name: "Assigned To Me"
                                      }];
                                  }
                              }
                              resolve(true);
                              return widgetHelpers.WidgetStatusHelper.Success();
                            },
                            reload: (settings) => {
                              if (settings.customSettings.data) {
                                  const s = JSON.parse(settings.customSettings.data);
                                  if (s && s.prCategory) {
                                      this._layout.categories = [{
                                        key: s.prCategory,
                                        name: settings.name
                                      }];
                                      this._layoutChanged.trigger(this._layout);
                                  }
                              }
                              return widgetHelpers.WidgetStatusHelper.Success();
                            }
                          };
                        });
                        VSS.notifyLoadSucceeded();
                      } else {
                        resolve(true);
                        VSS.notifyLoadSucceeded();
                      }
                  });
          });
      });
    }
}
